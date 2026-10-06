import 'server-only'
import type { EntityType } from '@/lib/pairsight/entity-types'
import { naturalKey } from '@/lib/pairsight/natural-key'
import { db } from '@/server/db/client'
import type { FieldRole } from './fields'
import { parseColumnRoles, parseRecordValues } from './json'
import { recordLabel } from './result-rows'

// What Results need from each record, stored on it so the database can sort,
// search and label pairs without loading the dataset (source_records.label,
// sortKey, searchText). The label can't go stale: a dataset's column roles
// and record type are fixed once it's saved.

// Rows written per statement when filling a dataset saved before these
// columns existed.
const FILL_BATCH = 5_000

export type RecordKeys = { label: string; sortKey: string; searchText: string }

export function recordKeys({
	reference,
	values,
	columnRoles,
	entityType
}: {
	reference: string
	values: Record<string, string>
	columnRoles: Record<string, FieldRole>
	entityType: EntityType
}): RecordKeys {
	const label = recordLabel({ values, columnRoles, reference, entityType })
	return {
		label,
		sortKey: naturalKey(reference),
		searchText: `${reference}\n${label}`.toLowerCase()
	}
}

// Fills the keys of a dataset saved before they existed, once: later calls
// find nothing to do. A dataset's runs share one record type.
export async function ensureRecordKeys({
	datasetId,
	entityType
}: {
	datasetId: string
	entityType: EntityType
}) {
	const missing = await db.sourceRecord.count({ where: { datasetId, sortKey: null } })
	if (missing === 0) return
	const dataset = await db.sourceDataset.findUniqueOrThrow({
		where: { id: datasetId },
		select: { columnRoles: true }
	})
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	for (;;) {
		const batch = await db.sourceRecord.findMany({
			where: { datasetId, sortKey: null },
			select: { id: true, reference: true, values: true },
			take: FILL_BATCH
		})
		if (batch.length === 0) return
		const keys = batch.map((record) =>
			recordKeys({
				reference: record.reference,
				values: parseRecordValues(record.values),
				columnRoles,
				entityType
			})
		)
		// One statement per batch: Prisma's updateMany can't give each row its
		// own values.
		await db.$executeRaw`
			UPDATE source_records AS s
			SET label = v.label, "sortKey" = v.sort_key, "searchText" = v.search_text
			FROM unnest(
				${batch.map((record) => record.id)}::uuid[],
				${keys.map((key) => key.label)}::text[],
				${keys.map((key) => key.sortKey)}::text[],
				${keys.map((key) => key.searchText)}::text[]
			) AS v(id, label, sort_key, search_text)
			WHERE s.id = v.id`
	}
}

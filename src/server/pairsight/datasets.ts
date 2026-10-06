import 'server-only'
import { entityTypeOf, startingRules, type EntityType } from '@/lib/pairsight/entity-types'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'
import { defaultIdentity } from './judgment'
import type { SourceRecordInput } from './source-records'
import { isIdentityRole, type FieldRole } from './fields'
import { getOwnedEvaluation } from './evaluations'
import { recordKeys } from './record-keys'
import { chunks } from './chunks'
import { parseBlockingRules } from './json'

// Records written per statement.
const SAVE_BATCH = 5_000

// The current dataset is the latest fully saved one; older datasets stay
// only for the runs that used them, and one still being written is never
// current.
export async function getCurrentDataset(evaluationId: string) {
	return db.sourceDataset.findFirst({
		where: { evaluationId, savedAt: { not: null } },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			fileName: true,
			rowCount: true,
			referenceColumn: true,
			columnRoles: true,
			createdAt: true
		}
	})
}

// Saves a file's records as the evaluation's new dataset. `readRecords`
// reads the (already checked) file and hands its records over a batch at a
// time; they're written as they come, so a file of any size is saved in
// flat memory. The dataset only becomes current once every record is in,
// and a save that fails part-way leaves nothing behind.
export async function saveSourceDataset({
	ownerId,
	evaluationId,
	fileName,
	referenceColumn,
	columnRoles,
	rowCount,
	readRecords,
	entityType
}: {
	ownerId: string
	evaluationId: string
	fileName: string
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	rowCount: number
	readRecords: (write: (records: SourceRecordInput[]) => Promise<void>) => Promise<void>
	entityType: EntityType
}) {
	const evaluation = await getOwnedEvaluation({ ownerId, id: evaluationId })
	const jevFields = [...new Set(Object.values(columnRoles).filter(isIdentityRole))]
	// A replacement of another kind starts from the new type's identity
	// definition and rules; the same type keeps what the user set. With no
	// rules on yet (a new evaluation), its starting rules follow the file:
	// none where PairSight will suggest the pairs, the defaults where it can't.
	const isSameType = entityTypeOf(evaluation.entityType) === entityType
	const hasNoRules = parseBlockingRules(evaluation.blockingRules).length === 0
	const typeDefaults = isSameType
		? {
				entityType,
				...(hasNoRules ? { blockingRules: startingRules(entityType, rowCount) } : {})
			}
		: {
				entityType,
				identitySame: defaultIdentity(entityType).same,
				identityDifferent: defaultIdentity(entityType).different,
				blockingRules: startingRules(entityType, rowCount)
			}
	const dataset = await db.sourceDataset.create({
		data: { evaluationId, fileName, rowCount, referenceColumn, columnRoles, savedAt: null },
		select: { id: true }
	})
	const write = async (records: SourceRecordInput[]) => {
		for (const batch of chunks(records, SAVE_BATCH)) {
			await db.sourceRecord.createMany({
				data: batch.map((record) => ({
					datasetId: dataset.id,
					reference: record.reference,
					rowNumber: record.rowNumber,
					values: record.values,
					...recordKeys({
						reference: record.reference,
						values: record.values,
						columnRoles,
						entityType
					})
				}))
			})
		}
	}
	try {
		await readRecords(write)
		await db.$transaction([
			// Current now, and queued for Splink (splink/score-dataset.ts).
			db.sourceDataset.update({
				where: { id: dataset.id },
				data: { savedAt: new Date(), scoreStatus: 'pending', scorePool: env.RUN_WORKER_POOL }
			}),
			db.evaluation.update({ where: { id: evaluationId }, data: { jevFields, ...typeDefaults } })
		])
	} catch (error) {
		// Its records go with it (cascade).
		await db.sourceDataset.deleteMany({ where: { id: dataset.id } })
		throw error
	}
	return dataset
}

export async function recordIdsByReference(datasetId: string): Promise<Map<string, string>> {
	const records = await db.sourceRecord.findMany({
		where: { datasetId },
		select: { id: true, reference: true }
	})
	return new Map(records.map((record) => [record.reference, record.id]))
}

// A saved dataset's first rows in file order, for showing it back.
export async function getDatasetPreview(datasetId: string, take: number) {
	return db.sourceRecord.findMany({
		where: { datasetId },
		orderBy: { rowNumber: 'asc' },
		take,
		select: { rowNumber: true, values: true }
	})
}

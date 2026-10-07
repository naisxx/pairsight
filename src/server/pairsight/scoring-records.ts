import 'server-only'
import { db } from '@/server/db/client'
import { mapRecordFields } from './fields'
import { parseColumnRoles, parseRecordValues } from './json'
import type { MappedFields } from './normalize'

// A record as PairSight's pair suggestions read it: its id and mapped fields.
export type ScoringRecord = { id: string; fields: MappedFields }

// A dataset's records for scoring (splink/score-dataset.ts). It reads the
// dataset's column roles itself; they're fixed once saved.
export async function loadScoringRecords(datasetId: string): Promise<ScoringRecord[]> {
	const [dataset, rows] = await Promise.all([
		db.sourceDataset.findUniqueOrThrow({ where: { id: datasetId }, select: { columnRoles: true } }),
		db.sourceRecord.findMany({ where: { datasetId }, select: { id: true, values: true } })
	])
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	return rows.map((record) => ({
		id: record.id,
		fields: mapRecordFields({ values: parseRecordValues(record.values), columnRoles })
	}))
}

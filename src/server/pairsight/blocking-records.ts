import 'server-only'
import { cache } from 'react'
import { db } from '@/server/db/client'
import type { BlockingRecord } from './blocking'
import { mapRecordFields } from './fields'
import { parseColumnRoles, parseRecordValues } from './json'

// A dataset's records as the comparison rules read them (their mapped
// fields), loaded once per request: the Rules screen's preview and its plan
// both need them, and 10,000 records are worth reading once, not twice.
// React's request cache; outside a render (an action) it's a plain call.
// Keyed by the dataset id alone (the cache compares arguments by identity),
// so it reads the dataset's column roles itself; they're fixed once saved.
export const loadBlockingRecords = cache(async (datasetId: string): Promise<BlockingRecord[]> => {
	const [dataset, rows] = await Promise.all([
		db.sourceDataset.findUniqueOrThrow({ where: { id: datasetId }, select: { columnRoles: true } }),
		db.sourceRecord.findMany({ where: { datasetId }, select: { id: true, values: true } })
	])
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	return rows.map((record) => ({
		id: record.id,
		fields: mapRecordFields({ values: parseRecordValues(record.values), columnRoles })
	}))
})

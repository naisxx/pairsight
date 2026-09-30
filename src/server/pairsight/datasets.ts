import 'server-only'
import { db } from '@/server/db/client'
import type { SourceRecordInput } from './csv'
import { isIdentityRole, type FieldRole } from './fields'
import { getOwnedEvaluation } from './evaluations'

// The current dataset is the latest one; older datasets stay only for the
// runs that used them.
export async function getCurrentDataset(evaluationId: string) {
	return db.sourceDataset.findFirst({
		where: { evaluationId },
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

export async function saveSourceDataset({
	ownerId,
	evaluationId,
	fileName,
	referenceColumn,
	columnRoles,
	records
}: {
	ownerId: string
	evaluationId: string
	fileName: string
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	records: SourceRecordInput[]
}) {
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	const jevFields = [...new Set(Object.values(columnRoles).filter(isIdentityRole))]
	return db.$transaction(async (tx) => {
		const dataset = await tx.sourceDataset.create({
			data: { evaluationId, fileName, rowCount: records.length, referenceColumn, columnRoles },
			select: { id: true }
		})
		await tx.sourceRecord.createMany({
			data: records.map((record) => ({
				datasetId: dataset.id,
				reference: record.reference,
				rowNumber: record.rowNumber,
				values: record.values
			}))
		})
		await tx.evaluation.update({ where: { id: evaluationId }, data: { jevFields } })
		return dataset
	})
}

export async function recordIdsByReference(datasetId: string): Promise<Map<string, string>> {
	const records = await db.sourceRecord.findMany({
		where: { datasetId },
		select: { id: true, reference: true }
	})
	return new Map(records.map((record) => [record.reference, record.id]))
}

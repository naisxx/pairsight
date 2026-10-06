import 'server-only'
import { defaultRules, entityTypeOf, type EntityType } from '@/lib/pairsight/entity-types'
import { db } from '@/server/db/client'
import { defaultIdentity } from './judgment'
import type { SourceRecordInput } from './source-records'
import { isIdentityRole, type FieldRole } from './fields'
import { getOwnedEvaluation } from './evaluations'
import { recordKeys } from './record-keys'

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
	records,
	entityType
}: {
	ownerId: string
	evaluationId: string
	fileName: string
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	records: SourceRecordInput[]
	entityType: EntityType
}) {
	const evaluation = await getOwnedEvaluation({ ownerId, id: evaluationId })
	const jevFields = [...new Set(Object.values(columnRoles).filter(isIdentityRole))]
	// A replacement of another kind starts from the new type's identity
	// definition and rules; the same type keeps what the user set. (A new
	// evaluation already holds the person defaults, so a first person file
	// changes nothing.)
	const typeDefaults =
		entityTypeOf(evaluation.entityType) === entityType
			? { entityType }
			: {
					entityType,
					identitySame: defaultIdentity(entityType).same,
					identityDifferent: defaultIdentity(entityType).different,
					blockingRules: defaultRules(entityType)
				}
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
				values: record.values,
				...recordKeys({
					reference: record.reference,
					values: record.values,
					columnRoles,
					entityType
				})
			}))
		})
		await tx.evaluation.update({
			where: { id: evaluationId },
			data: { jevFields, ...typeDefaults }
		})
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

// A saved dataset's first rows in file order, for showing it back.
export async function getDatasetPreview(datasetId: string, take: number) {
	return db.sourceRecord.findMany({
		where: { datasetId },
		orderBy: { rowNumber: 'asc' },
		take,
		select: { rowNumber: true, values: true }
	})
}

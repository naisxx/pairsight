import 'server-only'
import { AppError } from '@/lib/errors/app-error'
import { db } from '@/server/db/client'
import { getCurrentDataset } from './datasets'
import { evaluationNotFound, getOwnedEvaluation } from './evaluations'
import { LIMITS } from './limits'
import type { CanonicalPair } from './pairs'

export async function saveVendorExport({
	ownerId,
	evaluationId,
	name,
	fileName,
	mapping,
	pairs
}: {
	ownerId: string
	evaluationId: string
	name: string
	fileName: string
	mapping: { columnA: string; columnB: string }
	pairs: CanonicalPair[]
}) {
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	const dataset = await getCurrentDataset(evaluationId)
	if (dataset == null) {
		throw new AppError('Upload the source records before adding vendor results.', {
			code: 'no_dataset'
		})
	}
	const existing = await db.vendorExport.count({ where: { evaluationId, datasetId: dataset.id } })
	if (existing >= LIMITS.maxVendors) {
		throw new AppError(`An evaluation can compare up to ${LIMITS.maxVendors} vendors.`, {
			code: 'too_many_vendors'
		})
	}
	return db.$transaction(async (tx) => {
		const vendorExport = await tx.vendorExport.create({
			data: {
				evaluationId,
				datasetId: dataset.id,
				name,
				format: 'pair',
				fileName,
				mapping,
				confirmedCompleteAt: new Date(),
				pairCount: pairs.length
			},
			select: { id: true }
		})
		await tx.vendorMatch.createMany({
			data: pairs.map((pair) => ({
				exportId: vendorExport.id,
				recordAId: pair.a,
				recordBId: pair.b
			}))
		})
		return vendorExport
	})
}

export async function deleteVendorExport({
	ownerId,
	exportId
}: {
	ownerId: string
	exportId: string
}) {
	const { count } = await db.vendorExport.deleteMany({
		where: { id: exportId, evaluation: { ownerId, kind: 'live' } }
	})
	if (count === 0) throw evaluationNotFound()
}

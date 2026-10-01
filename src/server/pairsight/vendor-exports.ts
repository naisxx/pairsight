import 'server-only'
import { AppError } from '@/lib/errors/app-error'
import { db, Prisma } from '@/server/db/client'
import { getCurrentDataset } from './datasets'
import { evaluationNotFound, getOwnedEvaluation } from './evaluations'
import { parseCanonicalPairs, parseVendorColumns, parseVendorStats } from './json'
import { LIMITS } from './limits'
import type { CanonicalPair } from './pairs'
import type { VendorColumns, VendorFileStats } from './vendors'

// Vendors for the current dataset, in two states. A draft is being set up:
// named, maybe with a checked file. Confirming it complete turns it into an
// export with its matches — the only kind plans, runs and results read.
// Every function is owner-scoped (docs/rules/auth.md).

const VENDOR_LETTERS = ['A', 'B', 'C']

function noDataset() {
	return new AppError('Upload the source records before adding vendor results.', {
		code: 'no_dataset'
	})
}

async function currentDatasetOrThrow(evaluationId: string) {
	const dataset = await getCurrentDataset(evaluationId)
	if (dataset == null) throw noDataset()
	return dataset
}

export async function listVendors(evaluationId: string, datasetId: string) {
	const [exports, drafts] = await Promise.all([
		db.vendorExport.findMany({
			where: { evaluationId, datasetId },
			orderBy: { createdAt: 'asc' },
			select: {
				id: true,
				name: true,
				format: true,
				fileName: true,
				mapping: true,
				pairCount: true,
				stats: true,
				confirmedCompleteAt: true
			}
		}),
		db.vendorDraft.findMany({
			where: { evaluationId, datasetId },
			orderBy: { createdAt: 'asc' },
			select: {
				id: true,
				name: true,
				format: true,
				fileName: true,
				mapping: true,
				stats: true
			}
		})
	])
	return [
		...exports.map((item) => ({
			kind: 'export' as const,
			id: item.id,
			name: item.name,
			fileName: item.fileName,
			columns: parseVendorColumns(item.mapping),
			format: item.format,
			stats: parseVendorStats(item.stats),
			pairCount: item.pairCount,
			confirmedAt: item.confirmedCompleteAt
		})),
		...drafts.map((item) => ({
			kind: 'draft' as const,
			id: item.id,
			name: item.name,
			fileName: item.fileName,
			columns: parseVendorColumns(item.mapping),
			format: item.format,
			stats: parseVendorStats(item.stats),
			pairCount: parseVendorStats(item.stats)?.pairs ?? null,
			confirmedAt: null
		}))
	]
}

export type VendorListItem = Awaited<ReturnType<typeof listVendors>>[number]

// A new draft named "Vendor A/B/C" after the first letter not yet taken.
export async function createVendorDraft({
	ownerId,
	evaluationId
}: {
	ownerId: string
	evaluationId: string
}) {
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	const dataset = await currentDatasetOrThrow(evaluationId)
	const where = { evaluationId, datasetId: dataset.id }
	const [exports, drafts] = await Promise.all([
		db.vendorExport.findMany({ where, select: { name: true } }),
		db.vendorDraft.findMany({ where, select: { name: true } })
	])
	if (exports.length + drafts.length >= LIMITS.maxVendors) {
		throw new AppError(`An evaluation can compare up to ${LIMITS.maxVendors} vendors.`, {
			code: 'too_many_vendors'
		})
	}
	const names = new Set([...exports, ...drafts].map((vendor) => vendor.name))
	const letter = VENDOR_LETTERS.find((candidate) => !names.has(`Vendor ${candidate}`))
	return db.vendorDraft.create({
		data: {
			evaluationId,
			datasetId: dataset.id,
			name: `Vendor ${letter ?? exports.length + drafts.length + 1}`
		},
		select: { id: true }
	})
}

async function ownedDraft(ownerId: string, draftId: string) {
	const draft = await db.vendorDraft.findFirst({
		where: { id: draftId, evaluation: { ownerId, kind: 'live' } }
	})
	if (draft == null) throw evaluationNotFound()
	return draft
}

export async function renameVendor({
	ownerId,
	kind,
	id,
	name
}: {
	ownerId: string
	kind: 'draft' | 'export'
	id: string
	name: string
}) {
	const where = { id, evaluation: { ownerId, kind: 'live' as const } }
	const { count } =
		kind === 'draft'
			? await db.vendorDraft.updateMany({ where, data: { name } })
			: await db.vendorExport.updateMany({ where, data: { name } })
	if (count === 0) throw evaluationNotFound()
}

// A file that passed the checks; replaces any earlier one.
export async function setDraftFile({
	ownerId,
	draftId,
	fileName,
	columns,
	pairs,
	stats
}: {
	ownerId: string
	draftId: string
	fileName: string
	columns: VendorColumns
	pairs: CanonicalPair[]
	stats: VendorFileStats
}) {
	await ownedDraft(ownerId, draftId)
	await db.vendorDraft.update({
		where: { id: draftId },
		data: { fileName, format: columns.format, mapping: columns, pairs, stats }
	})
}

// A file that failed the checks leaves the draft without one, so what's saved
// never disagrees with the problems on screen.
export async function clearDraftFile({ ownerId, draftId }: { ownerId: string; draftId: string }) {
	await ownedDraft(ownerId, draftId)
	await db.vendorDraft.update({
		where: { id: draftId },
		data: {
			fileName: null,
			format: null,
			mapping: Prisma.DbNull,
			pairs: Prisma.DbNull,
			stats: Prisma.DbNull
		}
	})
}

export async function draftDatasetId(ownerId: string, draftId: string) {
	return (await ownedDraft(ownerId, draftId)).datasetId
}

// The user confirmed the file lists every match the vendor made: the draft
// becomes an export with its matches, in one transaction.
export async function confirmVendorDraft({
	ownerId,
	draftId
}: {
	ownerId: string
	draftId: string
}) {
	const draft = await ownedDraft(ownerId, draftId)
	const columns = parseVendorColumns(draft.mapping)
	const stats = parseVendorStats(draft.stats)
	const { fileName } = draft
	if (fileName == null || columns == null || stats == null) {
		throw new AppError('Upload this vendor’s file before confirming it.', { code: 'no_file' })
	}
	const pairs = parseCanonicalPairs(draft.pairs)
	return db.$transaction(async (tx) => {
		const vendorExport = await tx.vendorExport.create({
			data: {
				evaluationId: draft.evaluationId,
				datasetId: draft.datasetId,
				name: draft.name,
				format: columns.format,
				fileName,
				mapping: columns,
				confirmedCompleteAt: new Date(),
				pairCount: pairs.length,
				stats
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
		await tx.vendorDraft.delete({ where: { id: draftId } })
		return vendorExport
	})
}

export async function deleteVendor({
	ownerId,
	kind,
	id
}: {
	ownerId: string
	kind: 'draft' | 'export'
	id: string
}) {
	const where = { id, evaluation: { ownerId, kind: 'live' as const } }
	const { count } =
		kind === 'draft'
			? await db.vendorDraft.deleteMany({ where })
			: await db.vendorExport.deleteMany({ where })
	if (count === 0) throw evaluationNotFound()
}

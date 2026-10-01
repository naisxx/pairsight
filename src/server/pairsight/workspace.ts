import 'server-only'
import { cache } from 'react'
import { db } from '@/server/db/client'
import { getCurrentDataset } from './datasets'
import { getOwnedEvaluation } from './evaluations'

// Everything the evaluation workspace (step rail and step pages) needs. The
// layout and the page it wraps both ask for it; React's per-request cache
// (keyed on the two ids, so primitives) makes that one query, not two.
export function getWorkspace({ ownerId, evaluationId }: { ownerId: string; evaluationId: string }) {
	return loadWorkspace(ownerId, evaluationId)
}

const loadWorkspace = cache(async (ownerId: string, evaluationId: string) => {
	const evaluation = await getOwnedEvaluation({ ownerId, id: evaluationId })
	const [dataset, runs] = await Promise.all([
		getCurrentDataset(evaluationId),
		db.run.findMany({
			where: { evaluationId },
			orderBy: { number: 'desc' },
			select: {
				id: true,
				number: true,
				status: true,
				pairCount: true,
				threshold: true,
				createdAt: true
			}
		})
	])
	const vendorExports =
		dataset == null
			? []
			: await db.vendorExport.findMany({
					where: { evaluationId, datasetId: dataset.id },
					orderBy: { createdAt: 'asc' },
					select: { id: true, name: true, fileName: true, pairCount: true, createdAt: true }
				})
	return { evaluation, dataset, vendorExports, runs }
})

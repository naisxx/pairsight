import 'server-only'
import { cache } from 'react'
import { db } from '@/server/db/client'
import { getCurrentDataset } from './datasets'
import { getVisibleEvaluation } from './evaluations'
import { scopeKey, type EvaluationScope } from './scope'

// Everything the evaluation workspace (step rail and step pages) needs. The
// layout and the page it wraps both ask for it; React's per-request cache
// (keyed on primitives: the scope's key and the id) makes that one query.
export function getWorkspace({
	scope,
	evaluationId
}: {
	scope: EvaluationScope
	evaluationId: string
}) {
	return loadWorkspace(scopeKey(scope), scope, evaluationId)
}

const loadWorkspace = cache(async (_key: string, scope: EvaluationScope, evaluationId: string) => {
	const evaluation = await getVisibleEvaluation({ scope, id: evaluationId })
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
	const [vendorExports, vendorDraftCount] =
		dataset == null
			? [[], 0]
			: await Promise.all([
					db.vendorExport.findMany({
						where: { evaluationId, datasetId: dataset.id },
						orderBy: { createdAt: 'asc' },
						select: { id: true, name: true, fileName: true, pairCount: true, createdAt: true }
					}),
					db.vendorDraft.count({ where: { evaluationId, datasetId: dataset.id } })
				])
	return { evaluation, dataset, vendorExports, vendorDraftCount, runs }
})

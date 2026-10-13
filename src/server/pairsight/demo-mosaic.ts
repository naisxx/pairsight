import 'server-only'
import type { CategoryCounts } from '@/lib/pairsight/metrics'
import { rankVendors } from '@/lib/pairsight/ranking'
import { SANDBOX_EVALUATION_IDS } from '@/lib/pairsight/sandbox'
import { statsMetrics } from '@/lib/pairsight/stats'
import { db } from '@/server/db/client'
import { readRunSummary, runVendors, SUMMARY_RUN_SELECT } from './run-summary'
import { evaluationWhere, SANDBOX_SCOPE } from './scope'

// The demo's products run, as the sign-in and sign-up pages picture it (the
// mosaic beside the form): its best vendor's pairs by who said same, from the
// stored run summary, nothing loaded pair by pair. Null until `pnpm
// demo:seed` has run.
export async function demoMosaicCounts(): Promise<CategoryCounts | null> {
	const run = await db.run.findFirst({
		where: {
			evaluationId: SANDBOX_EVALUATION_IDS.product,
			evaluation: evaluationWhere(SANDBOX_SCOPE),
			status: 'completed'
		},
		orderBy: { number: 'desc' },
		select: { ...SUMMARY_RUN_SELECT, summary: true, summaryVersion: true }
	})
	if (run == null) return null
	const [vendors, summary] = await Promise.all([runVendors(run.exportIds), readRunSummary(run)])
	const [leader] = rankVendors(
		vendors.map((vendor) => ({
			metrics: statsMetrics(summary.rows, summary.vendorIds.indexOf(vendor.id))
		}))
	)
	return leader?.metrics.counts ?? null
}

import { PairScreen } from '@/components/pairsight/screens/pair-screen'
import { loadRun } from '@/server/pairsight/evaluation-pages'

export default async function PairPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string; runId: string; pairId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ id, runId, pairId }, rawFilters] = await Promise.all([params, searchParams])
	const loaded = await loadRun(
		{ kind: 'owner', id, path: `/evaluations/${id}/runs/${runId}/pairs/${pairId}` },
		runId
	)
	return <PairScreen loaded={loaded} pairId={pairId} rawFilters={rawFilters} />
}

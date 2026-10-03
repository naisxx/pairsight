import { PairScreen } from '@/components/pairsight/screens/pair-screen'
import { loadRun, sandboxTarget } from '@/server/pairsight/evaluation-pages'

export default async function SandboxPairPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string; runId: string; pairId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ id, runId, pairId }, rawFilters] = await Promise.all([params, searchParams])
	const loaded = await loadRun(sandboxTarget(id), runId)
	return <PairScreen loaded={loaded} pairId={pairId} rawFilters={rawFilters} />
}

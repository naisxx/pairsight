import { PairScreen } from '@/components/pairsight/screens/pair-screen'
import { loadRun, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxPairPage({
	params,
	searchParams
}: {
	params: Promise<{ runId: string; pairId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ runId, pairId }, rawFilters] = await Promise.all([params, searchParams])
	const loaded = await loadRun(SANDBOX_TARGET, runId)
	return <PairScreen loaded={loaded} pairId={pairId} rawFilters={rawFilters} />
}

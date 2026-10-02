import { ResultsScreen } from '@/components/pairsight/screens/results-screen'
import { loadRun, loadWorkspace, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxResultsPage({
	params,
	searchParams
}: {
	params: Promise<{ runId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ runId }, rawFilters] = await Promise.all([params, searchParams])
	const [loaded, { workspace }] = await Promise.all([
		loadRun(SANDBOX_TARGET, runId),
		loadWorkspace(SANDBOX_TARGET)
	])
	return <ResultsScreen loaded={loaded} workspace={workspace} rawFilters={rawFilters} />
}

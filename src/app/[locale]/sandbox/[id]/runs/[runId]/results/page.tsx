import { ResultsScreen } from '@/components/pairsight/screens/results-screen'
import { loadRun, loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'

export default async function SandboxResultsPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string; runId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ id, runId }, rawFilters] = await Promise.all([params, searchParams])
	const [loaded, { workspace }] = await Promise.all([
		loadRun(sandboxTarget(id), runId),
		loadWorkspace(sandboxTarget(id))
	])
	return <ResultsScreen loaded={loaded} workspace={workspace} rawFilters={rawFilters} />
}

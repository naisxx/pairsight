import { ResultsScreen } from '@/components/pairsight/screens/results-screen'
import { loadRun, loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'
import { stepTitle } from '@/i18n/page-title'

export const generateMetadata = stepTitle('results')

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

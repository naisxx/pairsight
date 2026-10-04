import { ResultsScreen } from '@/components/pairsight/screens/results-screen'
import { loadRun, loadWorkspace } from '@/server/pairsight/evaluation-pages'
import { stepTitle } from '@/i18n/page-title'

export const generateMetadata = stepTitle('results')

export default async function ResultsPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string; runId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	const [{ id, runId }, rawFilters] = await Promise.all([params, searchParams])
	const target = { kind: 'owner' as const, id, path: `/evaluations/${id}/runs/${runId}/results` }
	// The workspace was already loaded by the layout this request; it's cached.
	const [loaded, { workspace }] = await Promise.all([loadRun(target, runId), loadWorkspace(target)])
	return <ResultsScreen loaded={loaded} workspace={workspace} rawFilters={rawFilters} />
}

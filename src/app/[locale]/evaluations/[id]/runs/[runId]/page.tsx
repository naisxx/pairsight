import { RunScreen } from '@/components/pairsight/screens/run-screen'
import { loadRun } from '@/server/pairsight/evaluation-pages'

export default async function RunPage({
	params
}: {
	params: Promise<{ id: string; runId: string }>
}) {
	const { id, runId } = await params
	const loaded = await loadRun(
		{ kind: 'owner', id, path: `/evaluations/${id}/runs/${runId}` },
		runId
	)
	return <RunScreen loaded={loaded} />
}

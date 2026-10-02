import { PlanScreen } from '@/components/pairsight/screens/plan-screen'
import { loadWorkspace } from '@/server/pairsight/evaluation-pages'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const loaded = await loadWorkspace({ kind: 'owner', id, path: `/evaluations/${id}/plan` }, 'plan')
	return <PlanScreen loaded={loaded} />
}

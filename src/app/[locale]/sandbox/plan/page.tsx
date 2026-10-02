import { PlanScreen } from '@/components/pairsight/screens/plan-screen'
import { loadWorkspace, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxPlanPage() {
	return <PlanScreen loaded={await loadWorkspace(SANDBOX_TARGET, 'plan')} />
}

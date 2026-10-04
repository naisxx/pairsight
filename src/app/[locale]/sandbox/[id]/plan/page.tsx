import { PlanScreen } from '@/components/pairsight/screens/plan-screen'
import { loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'
import { stepTitle } from '@/i18n/page-title'

export const generateMetadata = stepTitle('plan')

export default async function SandboxPlanPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <PlanScreen loaded={await loadWorkspace(sandboxTarget(id), 'plan')} />
}

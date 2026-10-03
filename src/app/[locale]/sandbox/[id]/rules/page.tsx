import { RulesScreen } from '@/components/pairsight/screens/rules-screen'
import { loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'

export default async function SandboxRulesPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <RulesScreen loaded={await loadWorkspace(sandboxTarget(id), 'rules')} />
}

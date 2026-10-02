import { RulesScreen } from '@/components/pairsight/screens/rules-screen'
import { loadWorkspace, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxRulesPage() {
	return <RulesScreen loaded={await loadWorkspace(SANDBOX_TARGET, 'rules')} />
}

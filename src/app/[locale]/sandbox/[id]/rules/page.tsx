import { RulesScreen } from '@/components/pairsight/screens/rules-screen'
import { loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'
import { stepTitle } from '@/i18n/page-title'

export const generateMetadata = stepTitle('rules')

export default async function SandboxRulesPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <RulesScreen loaded={await loadWorkspace(sandboxTarget(id), 'rules')} />
}

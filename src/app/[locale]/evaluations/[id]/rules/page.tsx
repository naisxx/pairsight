import { RulesScreen } from '@/components/pairsight/screens/rules-screen'
import { loadWorkspace } from '@/server/pairsight/evaluation-pages'
import { stepTitle } from '@/i18n/page-title'

export const generateMetadata = stepTitle('rules')

export default async function RulesPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const loaded = await loadWorkspace(
		{ kind: 'owner', id, path: `/evaluations/${id}/rules` },
		'rules'
	)
	return <RulesScreen loaded={loaded} />
}

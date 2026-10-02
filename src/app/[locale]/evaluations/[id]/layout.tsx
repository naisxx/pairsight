import { dashboardHome, EvaluationLayout } from '@/components/pairsight/screens/evaluation-layout'
import { loadWorkspace } from '@/server/pairsight/evaluation-pages'

export default async function WorkspaceLayout({
	children,
	params
}: {
	children: React.ReactNode
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const [loaded, home] = await Promise.all([
		loadWorkspace({ kind: 'owner', id, path: `/evaluations/${id}` }),
		dashboardHome()
	])
	return (
		<EvaluationLayout loaded={loaded} home={home}>
			{children}
		</EvaluationLayout>
	)
}

import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { loadWorkspace, workspacePipeline } from './workspace'

export default async function WorkspaceLayout({
	children,
	params
}: {
	children: React.ReactNode
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const [{ user, workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}`),
		getTranslations('Shell')
	])
	const pipeline = await workspacePipeline(id, workspace)
	return (
		<AppShell
			email={user.email}
			name={user.name}
			pipeline={pipeline}
			crumbs={[
				{ label: t('evaluations'), href: '/evaluations' },
				{ label: workspace.evaluation.name, href: `/evaluations/${id}` }
			]}
		>
			{children}
		</AppShell>
	)
}

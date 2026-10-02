import { getTranslations } from 'next-intl/server'
import { EvaluationViewProvider } from '@/components/pairsight/evaluation-context'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import type { Crumb, ShellHome } from '@/components/pairsight/shell/pipeline-types'
import { workspacePipeline, type LoadedWorkspace } from '@/server/pairsight/evaluation-pages'

// Every evaluation page's frame: the shell with this evaluation's pipeline,
// and the view (base path, read-only) for the screens inside it.
export async function EvaluationLayout({
	loaded,
	home,
	banner,
	children
}: {
	loaded: LoadedWorkspace
	home: ShellHome
	banner?: React.ReactNode
	children: React.ReactNode
}) {
	const { viewer, view, workspace } = loaded
	const pipeline = await workspacePipeline(view, workspace)
	const crumbs: Crumb[] = [
		{ label: home.label, href: home.href },
		{ label: workspace.evaluation.name, href: view.base }
	]
	return (
		<AppShell viewer={viewer} home={home} pipeline={pipeline} crumbs={crumbs} banner={banner}>
			<EvaluationViewProvider value={view}>{children}</EvaluationViewProvider>
		</AppShell>
	)
}

export async function dashboardHome(): Promise<ShellHome> {
	const t = await getTranslations('Shell')
	return { href: '/evaluations', label: t('evaluations') }
}

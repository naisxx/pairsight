import { cookies } from 'next/headers'
import { RunsCentreProvider } from '@/components/pairsight/runs/runs-centre'
import { activeRunIds } from '@/server/pairsight/run-centre'
import type { EvaluationScope } from '@/server/pairsight/scope'
import type { Crumb, PipelineData, ShellHome, ShellViewer } from './pipeline-types'
import { ShellFrame } from './shell-frame'
import { Sidebar } from './sidebar'
import { SIDEBAR_COOKIE } from './sidebar-cookie'
import { TopBar } from './top-bar'

// The app's frame (docs/PairSight-UX-Plan.md §3): a full-height sidebar
// with the evaluation pipeline, a top bar with the breadcrumb and the
// evaluation's status, and the page. The remembered sidebar width comes from
// a cookie, so the first paint is already the right width. `viewer` is null
// only in the public sandbox, for someone who isn't signed in; `banner` sits
// above the page (the sandbox's). `scope` is whose runs the Runs centre shows
// and drives: the viewer's, or (read-only) the sandbox's.
export async function AppShell({
	viewer,
	home,
	crumbs,
	pipeline,
	banner,
	scope,
	children
}: {
	scope: EvaluationScope
	viewer: ShellViewer
	home: ShellHome
	crumbs: Crumb[]
	pipeline?: PipelineData
	banner?: React.ReactNode
	children: React.ReactNode
}) {
	const isSandbox = scope.kind === 'sandbox'
	const [cookieStore, activeIds] = await Promise.all([
		cookies(),
		isSandbox ? Promise.resolve([]) : activeRunIds(scope)
	])
	return (
		<RunsCentreProvider isSandbox={isSandbox} initialActiveIds={activeIds}>
			<ShellFrame
				initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
				sidebar={<Sidebar viewer={viewer} home={home} pipeline={pipeline} />}
				topBar={<TopBar crumbs={crumbs} pipeline={pipeline} />}
				banner={banner}
			>
				{children}
			</ShellFrame>
		</RunsCentreProvider>
	)
}

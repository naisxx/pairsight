import { RunsCentreProvider } from '@/components/pairsight/runs/runs-centre'
import { activeRunIds } from '@/server/pairsight/run-centre'
import type { EvaluationScope } from '@/server/pairsight/scope'
import type { Crumb, PipelineData, ShellHome, ShellViewer } from './pipeline-types'
import { ShellFrame } from './shell-frame'
import { TopBar } from './top-bar'

// The app's frame (docs/PairSight-UX-Plan.md §3, pairsight-handoff): a slim
// top bar with the mark, the breadcrumb and the account, the page, and on an
// evaluation the dock with its steps. `viewer` is null only in the public
// sandbox, for someone who isn't signed in; `badge` sits beside the
// breadcrumb (the sandbox's). `scope` is whose runs the Runs centre shows
// and drives: the viewer's, or (read-only) the sandbox's.
export async function AppShell({
	viewer,
	home,
	crumbs,
	pipeline,
	badge,
	scope,
	children
}: {
	scope: EvaluationScope
	viewer: ShellViewer
	home: ShellHome
	crumbs: Crumb[]
	pipeline?: PipelineData
	badge?: React.ReactNode
	children: React.ReactNode
}) {
	const isSandbox = scope.kind === 'sandbox'
	const activeIds = isSandbox ? [] : await activeRunIds(scope)
	return (
		<RunsCentreProvider isSandbox={isSandbox} initialActiveIds={activeIds}>
			<ShellFrame
				pipeline={pipeline}
				topBar={
					<TopBar
						crumbs={crumbs}
						homeHref={home.href}
						pipeline={pipeline}
						viewer={viewer}
						badge={badge}
					/>
				}
			>
				{children}
			</ShellFrame>
		</RunsCentreProvider>
	)
}

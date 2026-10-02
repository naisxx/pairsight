import { cookies } from 'next/headers'
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
// above the page (the sandbox's).
export async function AppShell({
	viewer,
	home,
	crumbs,
	pipeline,
	banner,
	children
}: {
	viewer: ShellViewer
	home: ShellHome
	crumbs: Crumb[]
	pipeline?: PipelineData
	banner?: React.ReactNode
	children: React.ReactNode
}) {
	const cookieStore = await cookies()
	return (
		<ShellFrame
			initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
			sidebar={<Sidebar viewer={viewer} home={home} pipeline={pipeline} />}
			topBar={<TopBar crumbs={crumbs} pipeline={pipeline} />}
			banner={banner}
		>
			{children}
		</ShellFrame>
	)
}

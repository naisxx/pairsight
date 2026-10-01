import { cookies } from 'next/headers'
import type { Crumb, PipelineData } from './pipeline-types'
import { ShellFrame } from './shell-frame'
import { Sidebar } from './sidebar'
import { SIDEBAR_COOKIE } from './sidebar-cookie'
import { TopBar } from './top-bar'

// The signed-in app's frame (docs/PairSight-UX-Plan.md §3): a full-height
// sidebar with the evaluation pipeline, a top bar with the breadcrumb, and
// the page. The remembered sidebar width comes from a cookie, so the first
// paint is already the right width.
export async function AppShell({
	email,
	crumbs,
	pipeline,
	children
}: {
	email: string
	crumbs: Crumb[]
	pipeline?: PipelineData
	children: React.ReactNode
}) {
	const cookieStore = await cookies()
	return (
		<ShellFrame
			initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
			sidebar={<Sidebar email={email} pipeline={pipeline} />}
			topBar={<TopBar crumbs={crumbs} stages={pipeline?.stages} />}
		>
			{children}
		</ShellFrame>
	)
}

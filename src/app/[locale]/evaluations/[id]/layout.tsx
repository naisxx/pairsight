import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AppHeader } from '@/components/pairsight/app-header'
import { StepperRail } from '@/components/pairsight/stepper-rail'
import { ChevronRightIcon } from '@/components/ui/icons'
import { loadWorkspace, workspaceSteps } from './workspace'

export default async function WorkspaceLayout({
	children,
	params
}: {
	children: React.ReactNode
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const [{ workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}`),
		getTranslations('Shell')
	])
	return (
		<>
			<AppHeader />
			<div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
				<aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:w-56 lg:shrink-0 lg:self-start">
					<nav
						aria-label="Breadcrumb"
						className="text-text-muted flex min-w-0 items-center gap-1 text-sm"
					>
						<Link href="/evaluations" className="hover:text-text shrink-0">
							{t('evaluations')}
						</Link>
						<ChevronRightIcon size={12} className="shrink-0" />
						<span className="text-text truncate font-medium" title={workspace.evaluation.name}>
							{workspace.evaluation.name}
						</span>
					</nav>
					<StepperRail steps={workspaceSteps(id, workspace)} />
				</aside>
				<main id="main" className="min-w-0 flex-1">
					{children}
				</main>
			</div>
		</>
	)
}

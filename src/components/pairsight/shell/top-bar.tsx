'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ChevronRightIcon, MenuIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { currentStageKey, type Crumb, type PipelineData } from './pipeline-types'
import { useShell } from './shell-frame'
import { EvaluationStatusChip } from './status-chip'
import { RunsTrigger } from '../runs/runs-trigger'

const MENU_ICON_SIZE = 18
const CRUMB_SEPARATOR_SIZE = 11

// The bar above the page: the phone menu button, where you are, and the
// evaluation's status. On an evaluation the last crumbs are the stage the
// page belongs to; the stage links back to its page from deeper ones (a pair
// back to its results).
export function TopBar({ crumbs, pipeline }: { crumbs: Crumb[]; pipeline?: PipelineData }) {
	const t = useTranslations('Shell')
	const tSteps = useTranslations('Steps')
	const pathname = usePathname()
	const { openMobile } = useShell()
	const stage =
		pipeline == null
			? undefined
			: pipeline.stages.find(
					(candidate) => candidate.key === currentStageKey(pipeline.stages, pathname)
				)
	const trail: Crumb[] =
		stage == null
			? crumbs
			: [
					...crumbs,
					{ label: tSteps(stage.key), href: pathname === stage.href ? undefined : stage.href }
				]

	return (
		<header className="border-border bg-surface flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-5">
			<Button
				variant="quiet"
				size="icon"
				className="md:hidden"
				onClick={openMobile}
				aria-label={t('openNavigation')}
			>
				<MenuIcon size={MENU_ICON_SIZE} />
			</Button>
			<nav aria-label={t('breadcrumb')} className="min-w-0">
				<ol className="type-ui flex min-w-0 items-center gap-1.5">
					{trail.map((crumb, index) => {
						const isLast = index === trail.length - 1
						return (
							<li
								key={`${crumb.label}-${index}`}
								className={cn(
									'flex min-w-0 items-center gap-1.5',
									// Where you are is never the part that's cut short.
									isLast && 'shrink-0',
									// On phones only the first and last two crumbs fit.
									index > 0 && index < trail.length - 2 && 'hidden sm:flex'
								)}
							>
								{index > 0 && (
									<ChevronRightIcon
										size={CRUMB_SEPARATOR_SIZE}
										className="text-text-muted shrink-0"
									/>
								)}
								{crumb.href != null && !isLast ? (
									<Link
										href={crumb.href}
										className="text-text-muted hover:text-text truncate transition-colors duration-150"
									>
										{crumb.label}
									</Link>
								) : (
									<span
										aria-current={isLast ? 'page' : undefined}
										className="text-text truncate font-medium"
									>
										{crumb.label}
									</span>
								)}
							</li>
						)
					})}
				</ol>
			</nav>
			<div className="ml-auto flex items-center gap-2">
				{pipeline != null && (
					<div className="hidden sm:block">
						<EvaluationStatusChip status={pipeline.status} />
					</div>
				)}
				<RunsTrigger />
			</div>
		</header>
	)
}

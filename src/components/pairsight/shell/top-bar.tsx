'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { ChevronRightIcon, SidebarIcon } from '@/components/ui/icons'
import { currentStageKey, type Crumb, type PipelineStage } from './pipeline-types'
import { useShell } from './shell-frame'

// The bar above the page: the sidebar toggle, then where you are. On an
// evaluation the last crumb is the stage the current page belongs to.
export function TopBar({ crumbs, stages }: { crumbs: Crumb[]; stages?: PipelineStage[] }) {
	const t = useTranslations('Shell')
	const tSteps = useTranslations('Steps')
	const pathname = usePathname()
	const { isCollapsed, isMobileOpen, toggleSidebar } = useShell()
	const stageKey = stages == null ? undefined : currentStageKey(stages, pathname)
	const trail: Crumb[] = stageKey == null ? crumbs : [...crumbs, { label: tSteps(stageKey) }]

	return (
		<header className="border-border bg-bg/85 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b pr-4 pl-3 backdrop-blur sm:pr-8">
			<button
				type="button"
				onClick={toggleSidebar}
				aria-controls="sidebar"
				aria-expanded={!isCollapsed || isMobileOpen}
				aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
				title={`${isCollapsed ? t('expandSidebar') : t('collapseSidebar')}  [`}
				className="text-text-muted hover:bg-surface-hover hover:text-text focus-visible:outline-ring grid size-8 shrink-0 place-items-center rounded transition-colors focus-visible:outline-2"
			>
				<SidebarIcon size={18} className="shell-toggle-icon" />
			</button>
			<span aria-hidden className="bg-border h-5 w-px shrink-0" />
			<nav aria-label={t('breadcrumb')} className="min-w-0">
				<ol className="type-body flex min-w-0 items-center gap-1.5">
					{trail.map((crumb, index) => {
						const isLast = index === trail.length - 1
						return (
							<li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
								{index > 0 && <ChevronRightIcon size={12} className="text-text-muted shrink-0" />}
								{crumb.href != null && !isLast ? (
									<Link
										href={crumb.href}
										className="text-text-muted hover:text-text truncate transition-colors"
									>
										{crumb.label}
									</Link>
								) : (
									<span
										aria-current={isLast ? 'page' : undefined}
										className={
											isLast ? 'text-text type-label truncate' : 'text-text-muted truncate'
										}
									>
										{crumb.label}
									</span>
								)}
							</li>
						)
					})}
				</ol>
			</nav>
		</header>
	)
}

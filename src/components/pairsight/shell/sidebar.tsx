'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { GridIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { Wordmark } from '../wordmark'
import { Pipeline } from './pipeline'
import type { PipelineData } from './pipeline-types'
import { useShell } from './shell-frame'
import { SidebarAccountMenu, SidebarThemeMenu } from './sidebar-menus'
import { SidebarTip } from './sidebar-tip'

// The full-height sidebar: brand, sections, the current evaluation's
// pipeline, then theme and account pinned to the bottom. Only the middle
// scrolls.
export function Sidebar({ email, pipeline }: { email: string; pipeline?: PipelineData }) {
	const t = useTranslations('Shell')
	const pathname = usePathname()
	const { closeMobile } = useShell()
	const isEvaluationsHome = pathname === '/evaluations'

	// Following a link inside the drawer closes it (phones only; harmless elsewhere).
	function onNavigate(event: React.MouseEvent) {
		if (event.target instanceof Element && event.target.closest('a')) closeMobile()
	}

	return (
		<aside
			id="sidebar"
			aria-label={t('mainNavigation')}
			className="shell-sidebar border-border bg-surface flex flex-col overflow-hidden border-r"
			onClick={onNavigate}
		>
			<div className="border-border flex h-14 shrink-0 items-center border-b pl-[1.375rem]">
				<Link
					href="/evaluations"
					aria-label="PairSight"
					className="focus-visible:outline-ring rounded focus-visible:outline-2 focus-visible:outline-offset-4"
				>
					<Wordmark labelClassName="shell-fade" className="text-base" />
				</Link>
			</div>

			<div className="shell-scroll flex-1 overflow-x-hidden overflow-y-auto px-2.5 py-3">
				<nav aria-label={t('sections')} className="flex flex-col gap-0.5 pb-3">
					<SidebarTip label={t('evaluations')}>
						<Link
							href="/evaluations"
							aria-current={isEvaluationsHome ? 'page' : undefined}
							className={cn(
								'type-label focus-visible:outline-ring flex h-9 items-center gap-3 overflow-hidden rounded px-4 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
								isEvaluationsHome
									? 'bg-selected text-text shadow-[inset_3px_0_0_var(--action)]'
									: 'text-text-muted hover:bg-surface-hover hover:text-text'
							)}
						>
							<GridIcon className="shrink-0" />
							<span className="shell-fade">{t('evaluations')}</span>
						</Link>
					</SidebarTip>
				</nav>
				{pipeline != null && (
					<div className="border-border border-t pt-3">
						<Pipeline data={pipeline} />
					</div>
				)}
			</div>

			<div className="border-border flex shrink-0 flex-col gap-0.5 border-t px-2.5 py-2">
				<SidebarThemeMenu />
				<SidebarAccountMenu email={email} />
			</div>
		</aside>
	)
}

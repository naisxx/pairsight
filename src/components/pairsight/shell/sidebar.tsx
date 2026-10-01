'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { CloseIcon, FolderIcon, SidebarIcon } from '@/components/ui/icons'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { LogoGlyph, Wordmark } from '../wordmark'
import { Pipeline } from './pipeline'
import type { PipelineData } from './pipeline-types'
import { useShell, useSidebarMode } from './shell-frame'
import { SidebarAccountMenu, SidebarThemeMenu } from './sidebar-menus'

const NAV_ICON_SIZE = 17

// The sidebar (docs/PairSight-UX-Plan.md §3): the brand and its collapse
// control, the sections, the current evaluation's pipeline, then theme and
// account pinned to the bottom. Only the middle scrolls.
export function Sidebar({
	email,
	name,
	pipeline
}: {
	email: string
	name: string
	pipeline?: PipelineData
}) {
	const t = useTranslations('Shell')
	const pathname = usePathname()
	const { toggleCollapsed, closeMobile } = useShell()
	const { isCollapsed, isMobile } = useSidebarMode()
	const isEvaluationsHome = pathname === '/evaluations'

	return (
		<div className="flex h-full flex-col">
			<div
				className={cn(
					'border-border flex h-12 shrink-0 items-center border-b',
					isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
				)}
			>
				{isCollapsed ? (
					<Tip content={t('expandSidebar')} side="right">
						<Button
							variant="quiet"
							size="icon"
							onClick={toggleCollapsed}
							aria-label={t('expandSidebar')}
							className="group"
						>
							<LogoGlyph className="group-hover:hidden" />
							<SidebarIcon size={NAV_ICON_SIZE} className="hidden group-hover:block" />
						</Button>
					</Tip>
				) : (
					<>
						<Link href="/evaluations" aria-label={t('home')} className="rounded-sm p-1">
							<Wordmark />
						</Link>
						{isMobile ? (
							<Button
								variant="quiet"
								size="icon-sm"
								onClick={closeMobile}
								aria-label={t('closeNavigation')}
							>
								<CloseIcon />
							</Button>
						) : (
							<Tip content={t('collapseSidebar')} side="right">
								<Button
									variant="quiet"
									size="icon-sm"
									onClick={toggleCollapsed}
									aria-label={t('collapseSidebar')}
								>
									<SidebarIcon />
								</Button>
							</Tip>
						)}
					</>
				)}
			</div>

			<nav
				aria-label={t('mainNavigation')}
				className={cn('flex-1 overflow-y-auto py-3', isCollapsed ? 'px-2' : 'px-2.5')}
			>
				<ul className="flex flex-col gap-0.5">
					<li>
						<Tip content={t('evaluations')} side="right" disabled={!isCollapsed}>
							<Link
								href="/evaluations"
								aria-current={isEvaluationsHome ? 'page' : undefined}
								aria-label={isCollapsed ? t('evaluations') : undefined}
								className={cn(
									'type-ui flex h-8 items-center gap-2.5 rounded-sm transition-colors duration-150',
									isCollapsed ? 'justify-center' : 'px-2',
									isEvaluationsHome
										? 'bg-selected text-text font-medium shadow-[inset_2px_0_0_var(--action)]'
										: 'text-text-muted hover:bg-surface-hover hover:text-text'
								)}
							>
								<FolderIcon size={NAV_ICON_SIZE} />
								{!isCollapsed && t('evaluations')}
							</Link>
						</Tip>
					</li>
				</ul>

				{pipeline != null && (
					<div className="mt-6">
						{isCollapsed ? (
							<div aria-hidden className="bg-border mx-auto h-px w-6" />
						) : (
							<div className="px-2">
								<p className="text-text-muted type-caption font-medium">{t('currentEvaluation')}</p>
								<p
									className="text-text type-ui mt-0.5 truncate font-medium"
									title={pipeline.evaluationName}
								>
									{pipeline.evaluationName}
								</p>
							</div>
						)}
						<Pipeline data={pipeline} />
					</div>
				)}
			</nav>

			<div
				className={cn(
					'border-border flex shrink-0 flex-col gap-0.5 border-t py-2',
					isCollapsed ? 'items-center px-1' : 'px-2.5'
				)}
			>
				<SidebarThemeMenu />
				<SidebarAccountMenu email={email} name={name} />
			</div>
		</div>
	)
}

'use client'

import { createContext, use, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { usePathname } from '@/i18n/routing'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EASE_OUT_SOFT } from '@/components/ui/reveal'
import { cn } from '@/lib/cn'
import { SIDEBAR_COOKIE } from './sidebar-cookie'

type Shell = {
	isCollapsed: boolean
	toggleCollapsed: () => void
	isMobileOpen: boolean
	openMobile: () => void
	closeMobile: () => void
}

const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
	const shell = use(ShellContext)
	if (shell == null) throw new Error('useShell must be used inside <ShellFrame>')
	return shell
}

// Which copy of the sidebar a component is rendered in: the desktop rail
// (which can collapse) or the phone drawer (always full width).
type SidebarMode = { isCollapsed: boolean; isMobile: boolean }
const SidebarModeContext = createContext<SidebarMode>({ isCollapsed: false, isMobile: false })

export function useSidebarMode(): SidebarMode {
	return use(SidebarModeContext)
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const MOBILE_QUERY = '(max-width: 47.99rem)'
const DRAWER_WIDTH_PX = 280
const DRAWER_DURATION_S = 0.22
const SCRIM_DURATION_S = 0.16
const PAGE_DURATION_S = 0.18
const PAGE_LIFT_PX = 4

function isTypingIn(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	)
}

// The app shell's client half (docs/PairSight-UX-Plan.md §3): a sidebar that
// collapses on desktop and is a sliding drawer on phones, and the page,
// which scrolls inside <main> and fades in on every navigation. The width is
// remembered in a cookie so the server renders it on the first paint, and
// `[` toggles it from anywhere.
export function ShellFrame({
	initialCollapsed,
	sidebar,
	topBar,
	children
}: {
	initialCollapsed: boolean
	sidebar: React.ReactNode
	topBar: React.ReactNode
	children: React.ReactNode
}) {
	const t = useTranslations('Shell')
	const pathname = usePathname()
	const isReduced = useReducedMotion() === true
	const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	// Following a link closes the drawer: track the path it was opened on.
	const [drawerPath, setDrawerPath] = useState(pathname)
	if (drawerPath !== pathname) {
		setDrawerPath(pathname)
		setIsMobileOpen(false)
	}

	// The sidebar width is remembered for the next visit (an external store).
	useEffect(() => {
		document.cookie = `${SIDEBAR_COOKIE}=${isCollapsed ? 'collapsed' : 'expanded'}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
	}, [isCollapsed])

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setIsMobileOpen(false)
			if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey) return
			if (isTypingIn(event.target)) return
			event.preventDefault()
			if (window.matchMedia(MOBILE_QUERY).matches) setIsMobileOpen((open) => !open)
			else setIsCollapsed((collapsed) => !collapsed)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [])

	const shell: Shell = {
		isCollapsed,
		toggleCollapsed: () => setIsCollapsed((collapsed) => !collapsed),
		isMobileOpen,
		openMobile: () => setIsMobileOpen(true),
		closeMobile: () => setIsMobileOpen(false)
	}

	return (
		<ShellContext value={shell}>
			<TooltipProvider>
				<div
					className="app-shell bg-bg text-text flex h-dvh w-full overflow-hidden"
					data-collapsed={isCollapsed}
					data-mobile-open={isMobileOpen}
				>
					<a
						href="#main"
						className="bg-surface text-text sr-only rounded-sm px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]"
					>
						{t('skipToContent')}
					</a>

					<aside
						aria-label={t('sidebar')}
						className={cn(
							'border-border bg-surface hidden shrink-0 border-r transition-[width] duration-200 ease-out md:block',
							isCollapsed ? 'w-[60px]' : 'w-[248px]'
						)}
					>
						<SidebarModeContext value={{ isCollapsed, isMobile: false }}>
							{sidebar}
						</SidebarModeContext>
					</aside>

					<AnimatePresence>
						{isMobileOpen && (
							<>
								<motion.div
									key="scrim"
									aria-hidden
									className="fixed inset-0 z-40 bg-black/40 md:hidden"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: SCRIM_DURATION_S }}
									onClick={() => setIsMobileOpen(false)}
								/>
								<motion.aside
									key="drawer"
									role="dialog"
									aria-modal="true"
									aria-label={t('navigation')}
									className="border-border bg-surface shadow-elevated fixed inset-y-0 left-0 z-50 w-[280px] border-r md:hidden"
									initial={isReduced ? { opacity: 0 } : { x: -DRAWER_WIDTH_PX }}
									animate={isReduced ? { opacity: 1 } : { x: 0 }}
									exit={isReduced ? { opacity: 0 } : { x: -DRAWER_WIDTH_PX }}
									transition={{ duration: DRAWER_DURATION_S, ease: EASE_OUT_SOFT }}
								>
									<SidebarModeContext value={{ isCollapsed: false, isMobile: true }}>
										{sidebar}
									</SidebarModeContext>
								</motion.aside>
							</>
						)}
					</AnimatePresence>

					<div className="flex min-w-0 flex-1 flex-col">
						{topBar}
						<main
							id="main"
							tabIndex={-1}
							className="[container-type:inline-size] relative flex-1 overflow-y-auto focus:outline-none"
						>
							<motion.div
								key={pathname}
								className="page-frame mx-auto flex min-h-full w-full max-w-[1280px] flex-col px-4 pt-6 pb-10 md:px-8"
								initial={isReduced ? false : { opacity: 0, y: PAGE_LIFT_PX }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: PAGE_DURATION_S, ease: EASE_OUT_SOFT }}
							>
								{children}
							</motion.div>
						</main>
					</div>
				</div>
			</TooltipProvider>
		</ShellContext>
	)
}

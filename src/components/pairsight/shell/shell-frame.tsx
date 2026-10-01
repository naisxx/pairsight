'use client'

import { createContext, use, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SIDEBAR_COOKIE } from './sidebar-cookie'

type Shell = {
	isCollapsed: boolean
	isMobileOpen: boolean
	toggleSidebar: () => void
	closeMobile: () => void
}

const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
	const shell = use(ShellContext)
	if (shell == null) throw new Error('useShell must be used inside <ShellFrame>')
	return shell
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const TOOLTIP_DELAY_MS = 200
const MOBILE_QUERY = '(max-width: 47.99rem)'

function isTypingIn(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	)
}

// The app shell's client half: whether the sidebar is collapsed (desktop) or
// open as a drawer (phones), the `[` shortcut, and the cookie that lets the
// server render the remembered width on the first paint.
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
	const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
	const [isMobileOpen, setIsMobileOpen] = useState(false)

	// The sidebar width is remembered for the next visit (an external store).
	useEffect(() => {
		document.cookie = `${SIDEBAR_COOKIE}=${isCollapsed ? 'collapsed' : 'expanded'}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
	}, [isCollapsed])

	// On phones the same control opens the drawer instead of collapsing.
	function toggleSidebar() {
		if (window.matchMedia(MOBILE_QUERY).matches) setIsMobileOpen((open) => !open)
		else setIsCollapsed((collapsed) => !collapsed)
	}

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
		isMobileOpen,
		toggleSidebar,
		closeMobile: () => setIsMobileOpen(false)
	}

	return (
		<ShellContext value={shell}>
			<TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
				<div className="app-shell" data-collapsed={isCollapsed} data-mobile-open={isMobileOpen}>
					<a
						href="#main"
						className="bg-action text-action-ink type-label sr-only z-[60] rounded px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
					>
						{t('skipToContent')}
					</a>
					{sidebar}
					{isMobileOpen && (
						<button
							type="button"
							aria-label={t('closeNavigation')}
							className="fixed inset-0 z-40 bg-black/50 md:hidden"
							onClick={() => setIsMobileOpen(false)}
						/>
					)}
					<div className="flex min-w-0 flex-col">
						{topBar}
						<main id="main" className="flex flex-1 flex-col px-4 py-7 sm:px-8">
							<div className="mx-auto flex w-full max-w-[110rem] flex-1 flex-col">{children}</div>
						</main>
					</div>
				</div>
			</TooltipProvider>
		</ShellContext>
	)
}

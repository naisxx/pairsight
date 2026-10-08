'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'

const SCROLL_KEY = 'pairsight:results-scroll'

type SavedScroll = { pathname: string; y: number }

function isTyping(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	)
}

// The page scrolls inside the app shell's <main>, not the window.
function scroller(): HTMLElement | null {
	return document.getElementById('main')
}

function rowLinks() {
	return [...document.querySelectorAll<HTMLAnchorElement>('[data-pairs-table] tbody a[href]')]
}

function readSaved(): SavedScroll | null {
	try {
		const raw = sessionStorage.getItem(SCROLL_KEY)
		sessionStorage.removeItem(SCROLL_KEY)
		const saved: unknown = raw == null ? null : JSON.parse(raw)
		return typeof saved === 'object' &&
			saved != null &&
			'pathname' in saved &&
			'y' in saved &&
			typeof saved.pathname === 'string' &&
			typeof saved.y === 'number'
			? { pathname: saved.pathname, y: saved.y }
			: null
	} catch {
		return null
	}
}

// The results list from the keyboard (docs/PairSight-UX-Plan.md §7): ↑/↓
// move the selection (the pair beside the list follows), Enter opens the
// selected pair on its own page, `/` jumps to search.
// Also puts the page back where it was when someone returns from a pair:
// the position is saved as a row is opened and used once on the way back.
export function ResultsKeyboard() {
	const router = useRouter()
	useEffect(() => {
		const saved = readSaved()
		if (saved != null && saved.pathname === window.location.pathname) {
			// After Next's own scroll-to-top for the navigation.
			requestAnimationFrame(() => scroller()?.scrollTo(0, saved.y))
		}

		function onKey(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
			if (event.key === '/') {
				event.preventDefault()
				document.querySelector<HTMLInputElement>('[data-results-search]')?.focus()
				return
			}
			const links = rowLinks()
			if (event.key === 'Enter') {
				// The selected row opens on its own page; another row is selected
				// by its link as usual.
				const link = links.find((candidate) => candidate === document.activeElement)
				const fullHref = link?.dataset.fullHref
				if (link?.getAttribute('aria-current') !== 'true' || fullHref == null) return
				event.preventDefault()
				router.push(fullHref)
				return
			}
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
			const index = links.findIndex((link) => link === document.activeElement)
			// Only take the arrows from the table, or from nowhere in particular
			// (the page itself: <body>, or <main> after a click on the page), so
			// they still work inside menus and fields everywhere else.
			const isOnPage =
				document.activeElement === document.body || document.activeElement === scroller()
			if (index === -1 && !isOnPage) return
			const next =
				index === -1
					? 0
					: Math.min(links.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))
			const link = links[next]
			if (link == null) return
			event.preventDefault()
			link.focus()
			// Selecting it shows it beside the list (a link that keeps the scroll).
			if (link.getAttribute('aria-current') !== 'true') link.click()
		}

		function onOpenRow(event: MouseEvent | KeyboardEvent) {
			if (event instanceof KeyboardEvent && event.key !== 'Enter') return
			if (!(event.target instanceof Element)) return
			// Leaving for a pair's own page: the selected row on Enter, or the
			// panel's link. Selecting a row stays on this page.
			const row = event.target.closest('[data-pairs-table] a')
			const isOpeningRow =
				event instanceof KeyboardEvent && row?.getAttribute('aria-current') === 'true'
			if (!isOpeningRow && event.target.closest('a[href*="/pairs/"]') == null) return
			// Read outside the try: the React Compiler can't yet compile
			// optional chaining inside one.
			const entry: SavedScroll = {
				pathname: window.location.pathname,
				y: scroller()?.scrollTop ?? 0
			}
			try {
				sessionStorage.setItem(SCROLL_KEY, JSON.stringify(entry))
			} catch {
				// Storage can be unavailable (private mode); the page just starts at the top.
			}
		}

		window.addEventListener('keydown', onKey)
		document.addEventListener('click', onOpenRow, true)
		document.addEventListener('keydown', onOpenRow, true)
		return () => {
			window.removeEventListener('keydown', onKey)
			document.removeEventListener('click', onOpenRow, true)
			document.removeEventListener('keydown', onOpenRow, true)
		}
	}, [router])
	return null
}

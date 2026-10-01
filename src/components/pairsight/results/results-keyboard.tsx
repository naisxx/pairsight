'use client'

import { useEffect } from 'react'

const SCROLL_KEY = 'pairsight:results-scroll'

type SavedScroll = { pathname: string; y: number }

function isTyping(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	)
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

// The results table from the keyboard (docs/PairSight-UX-Plan.md §7): ↑/↓
// move between pairs, Enter opens one (a native link), `/` jumps to search.
// Also puts the page back where it was when someone returns from a pair:
// the position is saved as a row is opened and used once on the way back.
export function ResultsKeyboard() {
	useEffect(() => {
		const saved = readSaved()
		if (saved != null && saved.pathname === window.location.pathname) {
			// After Next's own scroll-to-top for the navigation.
			requestAnimationFrame(() => window.scrollTo(0, saved.y))
		}

		function onKey(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
			if (event.key === '/') {
				event.preventDefault()
				document.querySelector<HTMLInputElement>('[data-results-search]')?.focus()
				return
			}
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
			const links = rowLinks()
			const index = links.findIndex((link) => link === document.activeElement)
			// Only take the arrows from the table, or from nowhere in particular,
			// so they still scroll the page and work inside menus everywhere else.
			if (index === -1 && document.activeElement !== document.body) return
			const next =
				index === -1
					? 0
					: Math.min(links.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))
			const link = links[next]
			if (link == null) return
			event.preventDefault()
			link.focus()
		}

		function onOpenRow(event: MouseEvent | KeyboardEvent) {
			if (event instanceof KeyboardEvent && event.key !== 'Enter') return
			if (
				!(event.target instanceof Element) ||
				event.target.closest('[data-pairs-table] a') == null
			) {
				return
			}
			try {
				const entry: SavedScroll = { pathname: window.location.pathname, y: window.scrollY }
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
	}, [])
	return null
}

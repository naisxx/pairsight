'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'

// J / K for next and previous, Esc back to the results list — skipped while
// typing in a field so it never steals keystrokes.
export function PairKeyboard({
	previousHref,
	nextHref,
	backHref
}: {
	previousHref: string | null
	nextHref: string | null
	backHref: string
}) {
	const router = useRouter()
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return
			const target = event.target
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
			) {
				return
			}
			if (event.key === 'j' && nextHref != null) router.push(nextHref)
			else if (event.key === 'k' && previousHref != null) router.push(previousHref)
			else if (event.key === 'Escape') router.push(backHref)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [router, previousHref, nextHref, backHref])
	return null
}

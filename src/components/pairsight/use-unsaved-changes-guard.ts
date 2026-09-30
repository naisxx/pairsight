'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Keeps a dirty form from being left by accident. Three exits, three layers:
//
// - In-app links (header, stepper, breadcrumb, anything rendering an <a>):
//   a capture-phase click listener stops the navigation and asks first.
// - Back/forward: an extra history entry for this same URL (the "sentinel").
//   Pressing back lands on the real entry instead of leaving, and we ask.
// - Reload, closing the tab, typing a URL: `beforeunload`. Browsers only
//   allow their own generic prompt there, not our dialog.

const SENTINEL_KEY = '__pairsightUnsavedGuard'

// How far back "leave" goes from the sentinel: past the sentinel and past
// the real entry for this page.
const LEAVE_HISTORY_STEPS = -2

type PendingLeave = { kind: 'link'; href: string } | { kind: 'history' }

function isOnSentinel(): boolean {
	const state: unknown = window.history.state
	return typeof state === 'object' && state != null && SENTINEL_KEY in state
}

function pushSentinel() {
	const state: unknown = window.history.state
	const base = typeof state === 'object' && state != null ? state : {}
	window.history.pushState({ ...base, [SENTINEL_KEY]: true }, '', window.location.href)
}

function interceptedHref(event: MouseEvent): string | null {
	if (event.defaultPrevented || event.button !== 0) return null
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
	const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
	if (!(anchor instanceof HTMLAnchorElement)) return null
	if ((anchor.target !== '' && anchor.target !== '_self') || anchor.hasAttribute('download')) {
		return null
	}
	const url = new URL(anchor.href)
	// Leaving the site unloads the page, which `beforeunload` already covers.
	if (url.origin !== window.location.origin) return null
	if (url.pathname === window.location.pathname && url.search === window.location.search) {
		return null
	}
	return `${url.pathname}${url.search}${url.hash}`
}

export function useUnsavedChangesGuard(isDirty: boolean) {
	const router = useRouter()
	const [pending, setPending] = useState<PendingLeave | null>(null)
	const isLeaving = useRef(false)

	useEffect(() => {
		if (!isDirty) return
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (isLeaving.current) return
			event.preventDefault()
		}
		const onClick = (event: MouseEvent) => {
			if (isLeaving.current) return
			const href = interceptedHref(event)
			if (href == null) return
			event.preventDefault()
			event.stopPropagation()
			setPending({ kind: 'link', href })
		}
		const onPopState = () => {
			if (isLeaving.current || isOnSentinel()) return
			// Back consumed the sentinel; put it back and ask instead.
			pushSentinel()
			setPending({ kind: 'history' })
		}
		if (!isOnSentinel()) pushSentinel()
		window.addEventListener('beforeunload', onBeforeUnload)
		document.addEventListener('click', onClick, true)
		window.addEventListener('popstate', onPopState)
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload)
			document.removeEventListener('click', onClick, true)
			window.removeEventListener('popstate', onPopState)
		}
	}, [isDirty])

	// For the form's own navigation after a successful save: whether to
	// replace the sentinel entry rather than push past it, so Back from the
	// next page returns here in one step.
	function beginLeave(): { shouldReplace: boolean } {
		isLeaving.current = true
		return { shouldReplace: isOnSentinel() }
	}

	function leave() {
		if (pending == null) return
		const { shouldReplace } = beginLeave()
		setPending(null)
		if (pending.kind === 'history') window.history.go(LEAVE_HISTORY_STEPS)
		else if (shouldReplace) router.replace(pending.href)
		else router.push(pending.href)
	}

	return {
		isConfirming: pending != null,
		stay: () => setPending(null),
		leave,
		beginLeave
	}
}

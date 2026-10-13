'use client'

import { useSyncExternalStore } from 'react'

// Whether a media query matches, kept current. The server and the first
// client render say no, so anything that depends on it waits for hydration.
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia(query)
			list.addEventListener('change', onChange)
			return () => list.removeEventListener('change', onChange)
		},
		() => window.matchMedia(query).matches,
		() => false
	)
}

// Whether the visitor's system allows motion.
export function usePrefersMotion(): boolean {
	return useMediaQuery('(prefers-reduced-motion: no-preference)')
}

// The landing's phone layout (pairsight-handoff Phone), under 600px.
export const PHONE_QUERY = '(max-width: 599px)'

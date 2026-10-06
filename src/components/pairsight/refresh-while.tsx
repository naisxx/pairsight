'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'

const EVERY_MS = 3_000

// Re-reads the page every few seconds while something it shows is still
// being worked out in the background (Splink looking at the records), so it
// updates by itself. Renders nothing.
export function RefreshWhile({ isActive }: { isActive: boolean }) {
	const router = useRouter()
	useEffect(() => {
		if (!isActive) return
		const timer = setInterval(() => router.refresh(), EVERY_MS)
		return () => clearInterval(timer)
	}, [isActive, router])
	return null
}

'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

const MS_PER_SECOND = 1_000
const TICK_MS = MS_PER_SECOND
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3_600

function formatDuration(totalSeconds: number) {
	const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR)
	const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
	const seconds = totalSeconds % SECONDS_PER_MINUTE
	const pad = (value: number) => String(value).padStart(2, '0')
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

function subscribeToClock(onTick: () => void) {
	const timer = setInterval(onTick, TICK_MS)
	return () => clearInterval(timer)
}
function stayStill() {
	return () => {}
}
// Whole seconds, so the snapshot is stable between reads within a tick.
const nowInSeconds = () => Math.floor(Date.now() / MS_PER_SECOND)
const noTimeOnServer = () => null

// Time since the run started, ticking while it runs and fixed once it's
// complete. The server renders no time, so the first client render agrees
// with it; the clock starts after hydration.
export function RunElapsed({
	startedAt,
	completedAt
}: {
	startedAt: Date
	completedAt: Date | null
}) {
	const t = useTranslations('Run')
	const nowSeconds = useSyncExternalStore(
		completedAt == null ? subscribeToClock : stayStill,
		nowInSeconds,
		noTimeOnServer
	)
	const endSeconds = completedAt != null ? completedAt.getTime() / MS_PER_SECOND : nowSeconds
	const seconds =
		endSeconds == null
			? null
			: Math.max(0, Math.round(endSeconds - startedAt.getTime() / MS_PER_SECOND))
	return (
		<p className="text-text-muted type-meta">
			{t('elapsed')}{' '}
			<span className="text-text type-data-sm">
				{seconds == null ? '—' : formatDuration(seconds)}
			</span>
		</p>
	)
}

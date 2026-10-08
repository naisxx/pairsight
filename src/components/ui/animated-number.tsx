'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useFormatter } from 'next-intl'
import { useExactCount } from './count'
import { EASE_OUT_SOFT } from './reveal'

const DURATION_S = 0.28
const COUNT_UP_S = 1.2

// Counts up from zero when it first appears, then tweens from what's on
// screen to the new value, so a threshold change reads as a change rather
// than a jump. A new value mid-tween carries on from where the number is,
// so dragging a slider moves it smoothly instead of restarting it.
// `format` renders every frame (and null).
export function AnimatedNumber({
	value,
	format,
	className,
	title,
	countUpS = COUNT_UP_S
}: {
	value: number | null
	format: (value: number | null) => string
	className?: string
	// What a hover shows, e.g. the exact figure behind a shortened count.
	title?: string
	// How long the first count up takes, in seconds.
	countUpS?: number
}) {
	const isReduced = useReducedMotion() === true
	const start = value == null ? null : 0
	const [shown, setShown] = useState(start)
	// What's on screen right now, mid-tween or not.
	const current = useRef(start)
	const isFirst = useRef(true)

	useEffect(() => {
		const from = current.current
		const duration = isFirst.current ? countUpS : DURATION_S
		isFirst.current = false
		if (isReduced || value == null || from == null || from === value) {
			current.current = value
			setShown(value)
			return
		}
		const controls = animate(from, value, {
			duration,
			ease: EASE_OUT_SOFT,
			onUpdate: (latest) => {
				current.current = latest
				setShown(latest)
			}
		})
		return () => controls.stop()
	}, [value, isReduced, countUpS])

	return (
		<span className={className} title={title}>
			{format(shown)}
		</span>
	)
}

const PERCENT_DECIMALS = 1
const PERCENT = 100

// Server components can't hand a format function to a client one, so the two
// formats the app uses get their own components. A count is written as every
// count is (src/i18n/formats.ts), exact on hover once shortened.
export function AnimatedCount({ value, className }: { value: number; className?: string }) {
	const format = useFormatter()
	const exact = useExactCount()
	return (
		<AnimatedNumber
			value={value}
			format={(shown) => format.number(Math.round(shown ?? 0), 'compact')}
			className={className}
			title={exact(value)}
		/>
	)
}

// A 0–1 share as "80.0%"; `emptyLabel` when there's nothing to divide by.
export function AnimatedPercent({
	value,
	emptyLabel,
	className
}: {
	value: number | null
	emptyLabel: string
	className?: string
}) {
	return (
		<AnimatedNumber
			value={value == null ? null : value * PERCENT}
			format={(shown) => (shown == null ? emptyLabel : `${shown.toFixed(PERCENT_DECIMALS)}%`)}
			className={className}
		/>
	)
}

const SCORE_DECIMALS = 2
// A pair's score comes in quicker than a headline: it's read pair after pair.
const SCORE_COUNT_UP_S = 0.5

// A 0–1 score as "0.83", counting up as a new pair comes in.
export function AnimatedScore({ value, className }: { value: number; className?: string }) {
	return (
		<AnimatedNumber
			value={value}
			format={(shown) => (shown ?? 0).toFixed(SCORE_DECIMALS)}
			className={className}
			countUpS={SCORE_COUNT_UP_S}
		/>
	)
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useFormatter } from 'next-intl'
import { useExactCount } from './count'
import { EASE_OUT_SOFT } from './reveal'

const DURATION_S = 0.28
const COUNT_UP_S = 1.2

// Counts up from zero when it first appears, then tweens from the previous
// value to the new one, so a threshold change reads as a change rather than
// a jump. `format` renders every frame (and null).
export function AnimatedNumber({
	value,
	format,
	className,
	title
}: {
	value: number | null
	format: (value: number | null) => string
	className?: string
	// What a hover shows, e.g. the exact figure behind a shortened count.
	title?: string
}) {
	const isReduced = useReducedMotion() === true
	const start = value == null ? null : 0
	const [shown, setShown] = useState(start)
	const previous = useRef(start)
	const isFirst = useRef(true)

	useEffect(() => {
		const from = previous.current
		const duration = isFirst.current ? COUNT_UP_S : DURATION_S
		previous.current = value
		isFirst.current = false
		if (isReduced || value == null || from == null || from === value) {
			setShown(value)
			return
		}
		const controls = animate(from, value, {
			duration,
			ease: EASE_OUT_SOFT,
			onUpdate: setShown
		})
		return () => controls.stop()
	}, [value, isReduced])

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

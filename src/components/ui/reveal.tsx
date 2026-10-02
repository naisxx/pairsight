'use client'

import { motion, useReducedMotion } from 'motion/react'

const STAGGER_S = 0.07
const MAX_DELAY_S = 0.56
const DURATION_S = 0.5
const LIFT_PX = 10
// The motion curve everywhere: fast out, gentle settle (globals.css
// --ease-out-soft is the CSS twin).
export const EASE_OUT_SOFT = [0.23, 1, 0.32, 1] as const

// A one-time entrance: a short fade and lift, staggered per item and capped
// so the last one never feels late. Skipped entirely under reduced motion.
export function Reveal({
	index = 0,
	as = 'div',
	className,
	children
}: {
	index?: number
	as?: 'div' | 'li' | 'tr'
	className?: string
	children: React.ReactNode
}) {
	const isReduced = useReducedMotion() === true
	const Component = as === 'li' ? motion.li : as === 'tr' ? motion.tr : motion.div
	return (
		<Component
			className={className}
			initial={isReduced ? false : { opacity: 0, y: LIFT_PX }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: DURATION_S,
				ease: EASE_OUT_SOFT,
				delay: Math.min(index * STAGGER_S, MAX_DELAY_S)
			}}
		>
			{children}
		</Component>
	)
}

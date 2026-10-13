'use client'

import { motion, useReducedMotion } from 'motion/react'

const STAGGER_S = 0.07
const MAX_DELAY_S = 0.56
// Nothing in the product runs longer than 240ms (pairsight-handoff Motion).
const DURATION_S = 0.24
const LIFT_PX = 10
// The motion curve everywhere: the design's arrival, fast out, gentle
// settle (globals.css --ease-arrive is the CSS twin).
export const EASE_OUT_SOFT = [0.2, 0, 0, 1] as const

// A one-time entrance: a short fade and lift, staggered per item and capped
// so the last one never feels late. Under reduced motion it's instant, from
// the same first frame the server rendered, so hydration matches.
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
			initial={{ opacity: 0, y: LIFT_PX }}
			animate={{ opacity: 1, y: 0 }}
			transition={
				isReduced
					? { duration: 0 }
					: {
							duration: DURATION_S,
							ease: EASE_OUT_SOFT,
							delay: Math.min(index * STAGGER_S, MAX_DELAY_S)
						}
			}
		>
			{children}
		</Component>
	)
}

'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { LazyMotion, MotionConfig, domAnimation, m, type Variants } from 'motion/react'

// The landing's motion (DESIGN.md §7): one staggered arrival in the hero,
// a fade and a 14 px rise for everything else as it scrolls into view (once),
// and smooth wheel scrolling. No blur on text, ever. Under reduced motion,
// Motion skips transforms (`reducedMotion="user"`) and Lenis tracks the wheel
// one to one.

export const EASE = [0.2, 0.7, 0.2, 1] as const
const RISE_PX = 14
const REVEAL_S = 0.6
const INTRO_S = 0.7
const INTRO_STEP_S = 0.08
const REVEAL_STEP_S = 0.08
// How much of a block shows before it plays.
const REVEAL_AMOUNT = 0.15
// Smooth scrolling: how quickly the page catches up with the wheel.
const SCROLL_LERP = 0.1
// Section links stop this far above their section, clear of the floating nav.
const ANCHOR_OFFSET_PX = -88

// Everything on the landing that moves: Motion's small bundle, the user's
// motion preference, and Lenis (wheel only; touch scrolls natively).
export function LandingMotion({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		const lenis = new Lenis({
			autoRaf: true,
			lerp: SCROLL_LERP,
			anchors: { offset: ANCHOR_OFFSET_PX }
		})
		return () => lenis.destroy()
	}, [])
	return (
		<LazyMotion features={domAnimation} strict>
			<MotionConfig reducedMotion="user">{children}</MotionConfig>
		</LazyMotion>
	)
}

const rise: Variants = {
	hidden: { opacity: 0, y: RISE_PX },
	shown: { opacity: 1, y: 0 }
}

// The hero's arrival: its children one after another, once, on load.
export function IntroSequence({
	className,
	children
}: {
	className?: string
	children: React.ReactNode
}) {
	return (
		<m.div
			className={className}
			initial="hidden"
			animate="shown"
			transition={{ staggerChildren: INTRO_STEP_S }}
		>
			{children}
		</m.div>
	)
}

export function IntroItem({
	className,
	children
}: {
	className?: string
	children: React.ReactNode
}) {
	return (
		<m.div className={className} variants={rise} transition={{ duration: INTRO_S, ease: EASE }}>
			{children}
		</m.div>
	)
}

// A block that fades and rises into place the first time it scrolls into
// view; `index` staggers siblings.
export function ScrollReveal({
	index = 0,
	as = 'div',
	className,
	children
}: {
	index?: number
	as?: 'div' | 'li'
	className?: string
	children: React.ReactNode
}) {
	const Component = as === 'li' ? m.li : m.div
	return (
		<Component
			className={className}
			variants={rise}
			initial="hidden"
			whileInView="shown"
			viewport={{ once: true, amount: REVEAL_AMOUNT }}
			transition={{ duration: REVEAL_S, ease: EASE, delay: index * REVEAL_STEP_S }}
		>
			{children}
		</Component>
	)
}

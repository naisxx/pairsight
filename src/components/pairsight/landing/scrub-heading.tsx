'use client'

import { useRef } from 'react'
import { m, useScroll, useTransform, type MotionValue } from 'motion/react'
import { cn } from '@/lib/cn'

// Words start faint and fill in one by one as the heading scrolls up the
// page (from 90% of the viewport up to 45%), and fade back if you scroll
// back above it. Under
// reduced motion they're all filled from the start (CSS, so the server's
// HTML is right before anything runs).
const FAINT = 0.22

export function ScrubHeading({
	lead,
	accent,
	id,
	className
}: {
	lead: string
	// The closing phrase, in the headline accent.
	accent: string
	id?: string
	className?: string
}) {
	const ref = useRef<HTMLHeadingElement>(null)
	const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'start 0.45'] })
	const words = lead.split(' ')
	const parts = words.length + 1
	const headingClass = cn('type-display-md', className)
	return (
		<h2 ref={ref} id={id} className={headingClass}>
			{words.map((word, index) => (
				<Word
					key={`${index}-${word}`}
					progress={scrollYProgress}
					at={index / parts}
					span={1 / parts}
				>
					{word}{' '}
				</Word>
			))}
			<Word progress={scrollYProgress} at={words.length / parts} span={1 / parts}>
				<span className="text-gradient">{accent}</span>
			</Word>
		</h2>
	)
}

function Word({
	progress,
	at,
	span,
	children
}: {
	progress: MotionValue<number>
	at: number
	span: number
	children: React.ReactNode
}) {
	const opacity = useTransform(progress, [at, at + span], [FAINT, 1])
	return (
		<m.span style={{ opacity }} className="motion-reduce:opacity-100!">
			{children}
		</m.span>
	)
}

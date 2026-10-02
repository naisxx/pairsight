'use client'

import { useEffect, useRef, useState } from 'react'

// A block plays once it's (nearly) all on screen, so one peeking above the
// fold on load waits for the scroll that brings it up, and one at the very
// bottom of the page still gets there. A block too tall to fit, or flicked
// past, plays once its top has passed the middle of the screen.
const ON_SCREEN_SHARE = 0.9
const SCREEN_MIDDLE = 0.5
const THRESHOLD_STEPS = 10
const THRESHOLDS = Array.from({ length: THRESHOLD_STEPS + 1 }, (_, step) => step / THRESHOLD_STEPS)

function isFarEnoughIn(entry: IntersectionObserverEntry): boolean {
	if (entry.intersectionRatio >= ON_SCREEN_SHARE) return true
	const screen = entry.rootBounds?.height ?? window.innerHeight
	return entry.boundingClientRect.top <= screen * SCREEN_MIDDLE
}

// Marks a block `data-in-view="true"` the first time it scrolls into view,
// so the CSS inside it (motion.css, .on-view) plays then, not on page load.
// It only flips an attribute; the server still renders the content.
export function InView({ className, children }: { className?: string; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [isInView, setIsInView] = useState(false)

	useEffect(() => {
		const element = ref.current
		if (element == null) return
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry != null && isFarEnoughIn(entry)) {
					setIsInView(true)
					observer.disconnect()
				}
			},
			{ threshold: THRESHOLDS }
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	return (
		<div ref={ref} data-in-view={isInView} className={className}>
			{children}
		</div>
	)
}

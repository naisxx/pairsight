'use client'

import { createContext, use, useState } from 'react'

type CutoffPreview = {
	// The run's own cut-off: what it decided, and what every list uses.
	runThreshold: number
	// The cut-off being previewed (the run's own until someone moves it).
	threshold: number
	setThreshold: (value: number) => void
	reset: () => void
	isPreviewing: boolean
}

const CutoffPreviewContext = createContext<CutoffPreview | null>(null)

// A "what if" cut-off for the Overview, shared by the cut-off bar that moves
// it and the numbers that follow it (the verdict, the vendor cards). Never
// saved: the run keeps its own, and a new one is set in What Jev checks.
export function CutoffPreviewProvider({
	runThreshold,
	children
}: {
	runThreshold: number
	children: React.ReactNode
}) {
	const [threshold, setThreshold] = useState(runThreshold)
	return (
		<CutoffPreviewContext
			value={{
				runThreshold,
				threshold,
				setThreshold,
				reset: () => setThreshold(runThreshold),
				isPreviewing: threshold !== runThreshold
			}}
		>
			{children}
		</CutoffPreviewContext>
	)
}

// Outside a provider (Detailed analysis), the run's own cut-off and no preview.
export function useCutoffPreview(runThreshold: number): CutoffPreview {
	const preview = use(CutoffPreviewContext)
	return (
		preview ?? {
			runThreshold,
			threshold: runThreshold,
			setThreshold: () => {},
			reset: () => {},
			isPreviewing: false
		}
	)
}

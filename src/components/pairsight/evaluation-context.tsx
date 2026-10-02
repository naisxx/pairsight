'use client'

import { createContext, use } from 'react'
import type { EvaluationView } from '@/lib/pairsight/evaluation-view'

// The current evaluation's view (src/lib/pairsight/evaluation-view.ts) for
// client components: where its pages live and whether it's read-only. Set
// once by the evaluation's layout.
const EvaluationViewContext = createContext<EvaluationView | null>(null)

export function EvaluationViewProvider({
	value,
	children
}: {
	value: EvaluationView
	children: React.ReactNode
}) {
	return <EvaluationViewContext value={value}>{children}</EvaluationViewContext>
}

export function useEvaluationView(): EvaluationView {
	const view = use(EvaluationViewContext)
	if (view == null) throw new Error('useEvaluationView needs an EvaluationViewProvider')
	return view
}

// True only inside the read-only sandbox; false anywhere else (including
// outside an evaluation), so shared components can call it unconditionally.
export function useIsReadOnly(): boolean {
	return use(EvaluationViewContext)?.isReadOnly ?? false
}

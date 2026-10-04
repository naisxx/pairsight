import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

type Step = 'records' | 'vendors' | 'rules' | 'plan' | 'results'

// A step page's browser tab title ("Rules · PairSight", from the root
// layout's template), so several evaluations open in tabs stay apart.
export function stepTitle(step: Step): () => Promise<Metadata> {
	return async () => {
		const t = await getTranslations('Steps')
		return { title: t(step) }
	}
}

// A page whose heading is its namespace's `title` (Evaluations, the demo).
export function pageTitle(namespace: 'Evaluations' | 'Sandbox'): () => Promise<Metadata> {
	return async () => {
		const t = await getTranslations(namespace)
		return { title: t('title') }
	}
}

'use client'

import { useDeferredValue } from 'react'
import { useTranslations } from 'next-intl'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { statsMetricsAt, type StatsRow } from '@/lib/pairsight/stats'
import { useCutoffPreview } from './cutoff-preview'
import { VerdictHeadline } from './verdict-headline'

// The run at a glance, as the page's headline: who scores higher overall (the
// ranking the whole product uses, ranking.ts) on its first line, by how much
// on a quieter second, then what the figures can and can't tell you. It
// follows the cut-off bar's preview (cutoff-preview.tsx).
export function Verdict({
	vendors,
	statsByVendor,
	runThreshold
}: {
	vendors: Array<{ id: string; name: string; metrics: VendorMetrics }>
	// Each vendor's counts by score, to follow a previewed cut-off.
	statsByVendor: Record<string, StatsRow[]>
	runThreshold: number
}) {
	const t = useTranslations('Results')
	const preview = useCutoffPreview(runThreshold)
	// A beat behind the slider while it's dragged, so the slider stays smooth.
	const threshold = useDeferredValue(preview.threshold)
	const isPreviewing = threshold !== runThreshold
	const shown = vendors.map((vendor) => {
		const stats = statsByVendor[vendor.id]
		return isPreviewing && stats != null
			? { ...vendor, metrics: statsMetricsAt(stats, 0, threshold) }
			: vendor
	})
	return (
		<section aria-labelledby="verdict-title" className="mt-4">
			<VerdictHeadline
				vendors={shown}
				as="h1"
				titleId="verdict-title"
				titleClassName="text-text font-display max-w-[1040px] text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.025em] text-balance"
				supportClassName="text-text-body mt-4 max-w-[680px] text-base"
				emphasis="quiet"
				showAgreed={false}
			>
				{t('resultsCaveat')}
			</VerdictHeadline>
		</section>
	)
}

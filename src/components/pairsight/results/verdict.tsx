'use client'

import { useDeferredValue } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { statsMetricsAt, type StatsRow } from '@/lib/pairsight/stats'
import { ComparisonScene } from '../empty/scenes'
import { useCutoffPreview } from './cutoff-preview'
import { VerdictHeadline } from './verdict-headline'

const ARROW_SIZE = 16

// The run at a glance, in its own card on a coral wash: who scores higher
// overall (the ranking the whole product uses, ranking.ts), how often each
// agreed with Jev under it, and the way into the disagreements. It follows the
// cut-off bar's preview (cutoff-preview.tsx).
export function Verdict({
	vendors,
	statsByVendor,
	runThreshold,
	disagreementsHref
}: {
	vendors: Array<{ id: string; name: string; metrics: VendorMetrics }>
	// Each vendor's counts by score, to follow a previewed cut-off.
	statsByVendor: Record<string, StatsRow[]>
	runThreshold: number
	disagreementsHref: { pathname: string; query: Record<string, string> } | null
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
		<section
			aria-labelledby="verdict-title"
			className="border-border bg-brand-wash relative mt-12 flex items-center gap-8 overflow-hidden rounded-lg border px-6 py-7 md:px-10 md:py-9"
		>
			<div className="min-w-0 flex-1">
				<p className="text-accent-ink type-eyebrow">{t('verdictEyebrow')}</p>
				<VerdictHeadline
					vendors={shown}
					as="h1"
					titleId="verdict-title"
					titleClassName="text-text type-display-md mt-3 max-w-3xl text-balance"
					supportClassName="mt-3 max-w-2xl text-[0.9375rem]"
				>
					{t('verdictCaveat')}
				</VerdictHeadline>
				{disagreementsHref != null && (
					<Button size="lg" className="group mt-6" asChild>
						<Link href={disagreementsHref}>
							{t('verdictCta')}
							<ArrowRightIcon
								size={ARROW_SIZE}
								className="transition-transform duration-200 group-hover:translate-x-1"
							/>
						</Link>
					</Button>
				)}
			</div>
			<div className="hidden shrink-0 @4xl:block">
				<ComparisonScene />
			</div>
		</section>
	)
}

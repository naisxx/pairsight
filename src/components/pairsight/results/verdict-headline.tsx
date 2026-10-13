'use client'

import { useTranslations } from 'next-intl'
import { EXACT_FORMATS } from '@/i18n/formats'
import { AnimatedPercent } from '@/components/ui/animated-number'
import { InfoTip } from '@/components/ui/info-tip'
import { agreedCount } from '@/lib/pairsight/agreement'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { rankVendors, verdictOf } from '@/lib/pairsight/ranking'
import { cn } from '@/lib/cn'

type Vendor = { id: string; name: string; metrics: VendorMetrics }

// The parts of the sentence that aren't words: the emphasis (vermilion, or
// the quiet second line of a two-line headline), a vendor's overall score
// (counting to its new value as a preview moves) and the mono counts.
const EMPHASIS = {
	accent: (chunks: React.ReactNode) => (
		<em className="text-accent-ink not-italic md:block">{chunks}</em>
	),
	quiet: (chunks: React.ReactNode) => <em className="text-text-muted block not-italic">{chunks}</em>
}
function percent(vendor: Vendor) {
	return <AnimatedPercent value={vendor.metrics.f1} emptyLabel="—" className="font-mono" />
}
function n(chunks: React.ReactNode) {
	return <span className="font-mono">{chunks}</span>
}

// The comparison in a sentence, ranked the one way the whole product ranks
// vendors (ranking.ts): who scores higher overall and by how much, a tie, or
// one vendor's score. Under it, how often each agreed with Jev, as a
// supporting line with a tip on what "agreed" counts. Shared by the Results
// verdict and the dashboard's latest result, so the two always say the same.
export function VerdictHeadline({
	vendors,
	as: Title = 'h2',
	titleId,
	titleClassName,
	supportClassName,
	emphasis = 'accent',
	showAgreed = true,
	children
}: {
	vendors: Vendor[]
	emphasis?: keyof typeof EMPHASIS
	// The line on how often each agreed with Jev (Results shows it in a table).
	showAgreed?: boolean
	as?: 'h1' | 'h2' | 'p'
	titleId?: string
	titleClassName?: string
	supportClassName?: string
	// After the supporting line, inside the same paragraph (a caveat).
	children?: React.ReactNode
}) {
	const t = useTranslations('Results')
	const shape = verdictOf(vendors)
	// In ranking order, like the sentence above it.
	const scored = showAgreed
		? rankVendors(vendors).filter((vendor) => vendor.metrics.assessed > 0)
		: []
	const em = EMPHASIS[emphasis]

	return (
		<>
			<Title id={titleId} className={titleClassName}>
				{shape.kind === 'none'
					? t('verdictNone')
					: shape.kind === 'single'
						? t.rich('verdictSingle', {
								vendor: shape.vendor.name,
								em,
								a: () => percent(shape.vendor)
							})
						: shape.kind === 'tie'
							? t.rich('verdictTie', {
									first: shape.first.name,
									second: shape.second.name,
									em,
									a: () => percent(shape.first)
								})
							: t.rich(shape.kind === 'close' ? 'verdictClose' : 'verdictLead', {
									lead: shape.lead.name,
									runnerUp: shape.runnerUp.name,
									em,
									a: () => percent(shape.lead),
									b: () => percent(shape.runnerUp)
								})}
			</Title>
			{(scored.length > 0 || children != null) && (
				<p className={cn('text-text-muted leading-relaxed', supportClassName)}>
					{scored.length > 0 && (
						<>
							{scored.map((vendor, index) => (
								<span key={vendor.id}>
									{index > 0 && '; '}
									{t.rich(
										// Said once: the vendors after the first take the short form.
										index === 0 ? 'verdictAgreed' : 'verdictAgreedMore',
										{
											vendor: vendor.name,
											agreed: agreedCount(vendor.metrics),
											total: vendor.metrics.assessed,
											n
										},
										EXACT_FORMATS
									)}
								</span>
							))}
							.
							<span className="ml-1 inline-flex align-middle">
								<InfoTip label={t('agreedTipLabel')} content={t('agreedTip')} />
							</span>{' '}
						</>
					)}
					{children}
				</p>
			)}
		</>
	)
}

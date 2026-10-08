'use client'

import { useTranslations } from 'next-intl'
import { InfoTip } from '@/components/ui/info-tip'
import type { EntityType } from '@/lib/pairsight/entity-types'
import { RulesCard } from './rules-card'

export type SuggestionsData = {
	// done: suggesting; waiting: still looking; skipped, failed: couldn't.
	state: 'waiting' | 'done' | 'skipped' | 'failed'
	// Says what PairSight compares for this type.
	entityType: EntityType
	suggested: number
	// What the suggested pairs share, most common first (reason codes).
	reasons: Array<{ reason: string; count: number }>
	// How many of each vendor's pairs PairSight suggests by itself.
	vendorCheck: Array<{ exportId: string; name: string; found: number; total: number }>
}

// Reasons drawn under "most suggested pairs share".
const TOP_REASONS = 4
const PERCENT = 100

function Bar({ share, className }: { share: number; className: string }) {
	return (
		<span aria-hidden className="bg-border block h-1.5 overflow-hidden rounded-full">
			<span
				className={`block h-full rounded-full transition-[width] duration-300 ease-out ${className}`}
				style={{ width: `${Math.min(PERCENT, share * PERCENT)}%` }}
			/>
		</span>
	)
}

// PairSight picks the pairs worth checking by itself: how many it found, what
// those pairs have in common (as bars), and how many of each vendor's pairs it
// would find anyway. Vendor pairs are only checked against, never used to
// choose. The technology behind it is never named (docs/rules/copy.md).
export function SuggestionsCard({
	data,
	className
}: {
	data: SuggestionsData
	className?: string
}) {
	const t = useTranslations('Rules')
	const tPlan = useTranslations('Plan')
	const strong = (chunks: React.ReactNode) => (
		<span className="text-text font-semibold">{chunks}</span>
	)
	const isShowingPicks = data.state === 'done'
	return (
		<RulesCard
			id="suggestions"
			eyebrow={t('suggestionsEyebrow')}
			title={
				<>
					{t('suggestionsTitle')}
					<InfoTip
						label={tPlan('suggestionsInfoLabel')}
						content={tPlan('suggestionsInfo', { type: data.entityType })}
					/>
				</>
			}
			description={t('suggestionsDescription', { type: data.entityType })}
			className={className}
		>
			{data.state === 'waiting' ? (
				<p className="text-text-muted type-ui">{t('suggestionsWaiting')}</p>
			) : !isShowingPicks ? (
				<p className="text-text-muted type-ui">{t('suggestionsUnavailable')}</p>
			) : (
				<p className="type-title">{t('suggestionsCount', { count: data.suggested })}</p>
			)}

			<div className="mt-5 grid flex-1 gap-6 @3xl:grid-cols-2">
				{isShowingPicks && data.reasons.length > 0 && data.suggested > 0 && (
					<div>
						<p className="text-text-muted type-ui">{t('suggestionsShare')}</p>
						<ul className="mt-2 space-y-2.5">
							{data.reasons.slice(0, TOP_REASONS).map(({ reason, count }) => {
								const share = count / data.suggested
								return (
									<li key={reason} className="type-ui">
										<span className="flex items-baseline justify-between gap-3">
											<span className="truncate">{t(`reason_${reason}`)}</span>
											<span className="text-text-muted font-mono text-xs">
												{Math.round(share * PERCENT)}%
											</span>
										</span>
										<span className="mt-1 block">
											<Bar share={share} className="bg-series-b" />
										</span>
									</li>
								)
							})}
						</ul>
					</div>
				)}
				{data.vendorCheck.length > 0 && (
					<div>
						<p className="text-text-muted type-ui flex items-center gap-1">
							{t('vendorCheckTitle')}
							<InfoTip label={t('vendorCheckInfoLabel')} content={t('vendorCheckNote')} />
						</p>
						<ul className="mt-2 space-y-3">
							{data.vendorCheck.map((vendor) => (
								<li key={vendor.exportId} className="type-ui">
									<span className="block">
										{t.rich('vendorCheck', {
											found: vendor.found,
											total: vendor.total,
											vendor: vendor.name,
											n: strong
										})}
									</span>
									<span className="mt-1.5 block">
										<Bar
											share={vendor.total === 0 ? 0 : vendor.found / vendor.total}
											className="bg-text-muted"
										/>
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</RulesCard>
	)
}

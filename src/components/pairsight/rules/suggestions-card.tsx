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

// Reasons drawn as bars.
const TOP_REASONS = 4
const PERCENT = 100
// Reasons that read as a clause of their own ("first and last names
// swapped"), not as what two records share.
const CLAUSE_REASONS = new Set(['name_swapped', 'trading_name_same'])

// PairSight picks the pairs worth checking by itself (pairsight-handoff
// Setup): how many it found, what those pairs have in common (as bars), and
// how many of each vendor's pairs it finds anyway, in a sentence. Vendor
// pairs are only checked against, never used to choose. The technology
// behind it is never named (docs/rules/copy.md).
export function SuggestionsCard({
	data,
	className
}: {
	data: SuggestionsData
	className?: string
}) {
	const t = useTranslations('Rules')
	const tPlan = useTranslations('Plan')
	const mono = (chunks: React.ReactNode) => (
		<strong className="text-text font-mono font-semibold">{chunks}</strong>
	)
	const isShowingPicks = data.state === 'done'
	return (
		<RulesCard
			id="suggestions"
			letter={t('letter.suggestions')}
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
				<p className="text-text-muted text-base">{t('suggestionsWaiting')}</p>
			) : !isShowingPicks ? (
				<p className="text-text-muted text-base">{t('suggestionsUnavailable')}</p>
			) : (
				<p className="text-text-body text-base">
					{t.rich('suggestionsCount', {
						count: data.suggested,
						n: (chunks) => (
							<span className="text-text mr-1 font-mono text-[2.5rem] leading-none font-semibold tracking-[-0.03em]">
								{chunks}
							</span>
						)
					})}
				</p>
			)}

			{isShowingPicks && data.reasons.length > 0 && data.suggested > 0 && (
				<ul className="mt-3">
					{data.reasons.slice(0, TOP_REASONS).map(({ reason, count }) => {
						const share = count / data.suggested
						const label = t(`reason_${reason}`)
						return (
							<li key={reason} className="flex items-center gap-3 py-2">
								<span className="text-text-muted shrink-0 basis-[190px] text-sm">
									{CLAUSE_REASONS.has(reason) ? label : t('reasonShare', { reason: label })}
								</span>
								<span aria-hidden className="bg-border h-1.5 flex-1 overflow-hidden rounded-full">
									<span
										className="bg-text block h-full transition-[width] duration-200 ease-out"
										style={{ width: `${Math.min(PERCENT, share * PERCENT)}%` }}
									/>
								</span>
								<span className="text-text w-12 shrink-0 text-right font-mono font-semibold tracking-[-0.03em]">
									{Math.round(share * PERCENT)}%
								</span>
							</li>
						)
					})}
				</ul>
			)}
			{data.vendorCheck.length > 0 && (
				<p className="border-border text-text-body mt-4 border-t pt-4 text-base">
					{t('vendorCheckLead')}
					{data.vendorCheck.map((vendor, index) => (
						<span key={vendor.exportId}>
							{index > 0 && t('vendorCheckAnd')}
							{t.rich('vendorCheck', {
								found: vendor.found,
								total: vendor.total,
								vendor: vendor.name,
								n: mono
							})}
						</span>
					))}
					{t('vendorCheckTail')}{' '}
					<span className="inline-flex align-middle">
						<InfoTip label={t('vendorCheckInfoLabel')} content={t('vendorCheckNote')} />
					</span>
				</p>
			)}
		</RulesCard>
	)
}

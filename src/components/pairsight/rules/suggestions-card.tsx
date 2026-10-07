'use client'

import { useTranslations } from 'next-intl'
import { InfoTip } from '@/components/ui/info-tip'
import { Switch } from '@/components/ui/switch'
import type { EntityType } from '@/lib/pairsight/entity-types'

export type SuggestionsData = {
	// done: suggesting; waiting: still looking; off, skipped, failed: not.
	state: 'off' | 'waiting' | 'done' | 'skipped' | 'failed'
	// Says what PairSight compares for this type.
	entityType: EntityType
	suggested: number
	// What the suggested pairs share, most common first (reason codes).
	reasons: Array<{ reason: string; count: number }>
	// How many of each vendor's pairs the plan picks by itself.
	vendorCheck: Array<{ exportId: string; name: string; found: number; total: number }>
}

// Reasons listed under "most suggested pairs share".
const TOP_REASONS = 4
const PERCENT = 100

// PairSight picks the pairs worth checking by itself (on by default): what
// it found, what those pairs have in common, and how many of each vendor's
// pairs it would find anyway. Vendor pairs are only checked against, never
// used to choose. The technology behind it is never named (docs/rules/copy.md).
export function SuggestionsCard({
	isOn,
	onChange,
	data
}: {
	isOn: boolean
	onChange: (isOn: boolean) => void
	data: SuggestionsData
}) {
	const t = useTranslations('Rules')
	const tPlan = useTranslations('Plan')
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const isShowingPicks = isOn && data.state === 'done'
	return (
		<section
			aria-labelledby="suggestions-title"
			className="border-border bg-surface rounded-md border px-5 py-4"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<h2 id="suggestions-title" className="flex items-center gap-1 text-base font-semibold">
						{t('suggestionsTitle')}
						<InfoTip
							label={tPlan('suggestionsInfoLabel')}
							content={tPlan('suggestionsInfo', { type: data.entityType })}
						/>
					</h2>
					<p className="type-ui text-text-muted mt-1">
						{t('suggestionsDescription', { type: data.entityType })}
					</p>
				</div>
				<label className="type-ui flex shrink-0 items-center gap-2">
					<Switch checked={isOn} onCheckedChange={onChange} />
					{t('suggestionsSwitch')}
				</label>
			</div>

			<div className="type-ui mt-3 space-y-2">
				{!isOn ? (
					<p className="text-text-muted">{t('suggestionsOff')}</p>
				) : data.state === 'waiting' ? (
					<p className="text-text-muted">{t('suggestionsWaiting')}</p>
				) : data.state !== 'done' ? (
					<p className="text-text-muted">{t('suggestionsUnavailable')}</p>
				) : (
					<p className="font-medium">{t('suggestionsCount', { count: data.suggested })}</p>
				)}
				{isShowingPicks && data.reasons.length > 0 && data.suggested > 0 && (
					<p>
						<span className="text-text-muted">{t('suggestionsShare')}: </span>
						{data.reasons
							.slice(0, TOP_REASONS)
							.map(({ reason, count }) =>
								t('reasonShare', {
									reason: t(`reason_${reason}`),
									percent: Math.round((count / data.suggested) * PERCENT)
								})
							)
							.join(' · ')}
					</p>
				)}
				{data.vendorCheck.map((vendor) => (
					<p key={vendor.exportId} className="flex items-center gap-1">
						<span>
							{t.rich('vendorCheck', {
								found: vendor.found,
								total: vendor.total,
								vendor: vendor.name,
								n: mono
							})}
						</span>
						<InfoTip label={t('vendorCheckInfoLabel')} content={t('vendorCheckNote')} />
					</p>
				))}
			</div>
		</section>
	)
}

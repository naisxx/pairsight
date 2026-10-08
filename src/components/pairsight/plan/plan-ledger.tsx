import { MIN_RECORDS } from '@/lib/pairsight/entity-types'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import type { PlanCounts } from '@/server/pairsight/plan'
import type { RunDuration } from '@/server/pairsight/run-estimate'
import type { EntityType } from '@/lib/pairsight/entity-types'
import type { SkipReason, SplinkState } from '@/server/pairsight/splink/picks'
import { InfoTip } from '@/components/ui/info-tip'
import { Count } from '@/components/ui/count'

const PERCENT = 100
// Below this share of the possible pairs, say "under 0.1%" rather than 0%.
const SMALL_SHARE = 0.1

// One step of the flow: a label, the number, and a short line under it.
function Step({
	label,
	value,
	note,
	isHighlighted = false,
	isDanger = false,
	hasNext = false
}: {
	label: React.ReactNode
	value: React.ReactNode
	note: React.ReactNode
	isHighlighted?: boolean
	isDanger?: boolean
	// Points on to the next step (drawn in CSS: a list item holds only terms
	// and values).
	hasNext?: boolean
}) {
	return (
		<div
			className={cn(
				'relative flex h-full min-w-0 flex-col rounded-md border p-4',
				hasNext &&
					"@5xl:after:text-text-muted @5xl:after:absolute @5xl:after:top-1/2 @5xl:after:-right-[11px] @5xl:after:z-[1] @5xl:after:-translate-y-1/2 @5xl:after:content-['→']",
				isHighlighted ? 'border-action bg-brand-wash' : 'border-border bg-surface-muted'
			)}
		>
			<dt className="text-text-muted type-ui flex items-center gap-1">{label}</dt>
			<dd
				className={cn(
					'mt-2 font-mono text-3xl leading-none font-medium tracking-[-0.03em]',
					isHighlighted && 'text-accent-ink',
					isDanger && 'text-danger'
				)}
			>
				{value}
			</dd>
			<dd className="text-text-muted mt-2 flex min-w-0 items-center gap-1 text-xs">{note}</dd>
		</div>
	)
}

// One bar of two parts, with a legend under it.
function SplitBar({
	label,
	parts
}: {
	label: string
	parts: Array<{ key: string; value: number; className: string }>
}) {
	const total = parts.reduce((sum, part) => sum + part.value, 0)
	return (
		<div
			role="img"
			aria-label={label}
			className="bg-border flex h-2.5 gap-0.5 overflow-hidden rounded-full"
		>
			{total > 0 &&
				parts.map((part) => (
					<span
						key={part.key}
						className={cn(
							'h-full min-w-0 transition-[flex-grow] duration-300 ease-out',
							part.className
						)}
						style={{ flexGrow: part.value }}
					/>
				))}
		</div>
	)
}

// "From records to pairs", drawn: the records, every possible pair, the pairs
// Jev will check and the new checks, as four numbers in a row; then where the
// pairs come from (PairSight's suggestions plus every vendor pair) and how
// many are reused, as bars. The detail behind each is a hover away.
export async function PlanLedger({
	counts,
	fileName,
	cost,
	duration,
	splink,
	entityType,
	isOverLimit
}: {
	counts: PlanCounts
	fileName: string
	cost: string
	// How long its new checks should take, padded (run-estimate.ts).
	duration: RunDuration
	// PairSight's suggestions (splink/picks.ts): whether they're in, coming, or not.
	splink: { state: SplinkState; reason: SkipReason | null }
	// Says what PairSight compares for this type.
	entityType: EntityType
	isOverLimit: boolean
}) {
	const t = await getTranslations('Plan')
	// Vendor pairs PairSight suggested too: counted once.
	const vendorInside = counts.vendorPairs - counts.addedByVendorOnly
	const possible = counts.allPossiblePairs
	const share = possible === 0 ? 0 : (counts.uniquePairs / possible) * PERCENT
	const shareText =
		share > 0 && share < SMALL_SHARE ? t('shareUnder') : `${share.toFixed(share < 1 ? 1 : 0)}%`
	const durationText =
		duration.unit === 'none'
			? null
			: duration.unit === 'underMinute'
				? t('takesUnderMinute')
				: duration.unit === 'minutes'
					? t('takesMinutes', { count: duration.value })
					: t('takesHours', { count: duration.value })
	const suggestedNote =
		splink.state === 'done'
			? t('rowSuggestedNote')
			: splink.state === 'waiting'
				? t('rowSuggestedWaiting')
				: splink.reason === 'too_few_records'
					? t('rowSuggestedTooFew', { min: MIN_RECORDS })
					: t('rowSuggestedFailed')

	return (
		<section
			aria-labelledby="ledger-title"
			className="border-border bg-surface rounded-lg border p-5 md:p-6"
		>
			<h2 id="ledger-title" className="type-heading">
				{t('ledgerTitle')}
			</h2>

			<dl className="mt-4 grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-4">
				<Step
					hasNext
					label={t('rowRecords')}
					value={<Count value={counts.records} />}
					note={<span className="truncate font-mono">{fileName}</span>}
				/>
				<Step
					hasNext
					label={t('rowPossible')}
					value={<Count value={possible} />}
					note={t('rowPossibleNote')}
				/>
				<Step
					hasNext
					isHighlighted={!isOverLimit}
					isDanger={isOverLimit}
					label={t('rowUnique')}
					value={<Count value={counts.uniquePairs} />}
					note={
						<>
							<span className="truncate" title={t('uniqueShare', { share: shareText })}>
								{t('uniqueShare', { share: shareText })}
							</span>
							<InfoTip
								label={t('coverageInfoLabel')}
								content={t('coverageTip', {
									rest: Math.max(0, possible - counts.uniquePairs)
								})}
							/>
						</>
					}
				/>
				<Step
					label={t('rowNew')}
					value={<Count value={counts.toEvaluate} />}
					note={
						<>
							<span
								className="truncate"
								title={`${t('rowNewNote', { cost })}${durationText != null ? ` · ${durationText}` : ''}`}
							>
								{t('rowNewNote', { cost })}
								{durationText != null && <> · {durationText}</>}
							</span>
							<InfoTip label={t('estimateInfoLabel')} content={t('estimateInfo')} />
						</>
					}
				/>
			</dl>

			<div className="mt-6 grid grid-cols-1 gap-6 @3xl:grid-cols-2">
				{/* Where the pairs come from. */}
				<div>
					<h3 className="type-subheading flex items-center gap-1">
						{t('sourcesTitle')}
						<InfoTip
							label={t('suggestionsInfoLabel')}
							content={t('suggestionsInfo', { type: entityType })}
						/>
					</h3>
					<div className="mt-3">
						<SplitBar
							label={t('sourcesBarLabel', {
								suggested: counts.suggestedPairs,
								added: counts.addedByVendorOnly
							})}
							parts={[
								{ key: 'suggested', value: counts.suggestedPairs, className: 'bg-series-b' },
								{ key: 'vendor', value: counts.addedByVendorOnly, className: 'bg-series-a' }
							]}
						/>
					</div>
					<dl className="type-ui mt-3 space-y-1.5">
						<div className="flex items-baseline gap-2">
							<span aria-hidden className="bg-series-b size-2.5 shrink-0 rounded-[3px]" />
							<dt className="min-w-0 flex-1">
								{t('rowSuggested')}
								{splink.state !== 'done' && (
									<span className="text-text-muted block text-xs">{suggestedNote}</span>
								)}
							</dt>
							<dd className="font-mono">
								{splink.state === 'done' ? <Count value={counts.suggestedPairs} /> : '–'}
							</dd>
						</div>
						<div className="flex items-baseline gap-2">
							<span aria-hidden className="bg-series-a size-2.5 shrink-0 rounded-[3px]" />
							<dt className="min-w-0 flex-1">{t('rowVendor')}</dt>
							<dd className="font-mono">
								+<Count value={counts.vendorPairs} />
							</dd>
						</div>
					</dl>
					{vendorInside > 0 && (
						<p className="text-text-muted mt-2 text-xs">
							{t('rowDuplicatesNote', { inside: vendorInside })}
						</p>
					)}
				</div>

				{/* What's reused from earlier runs, and what's new. */}
				<div>
					<h3 className="type-subheading">{t('reuseTitle')}</h3>
					<div className="mt-3">
						<SplitBar
							label={t('reuseBarLabel', { reused: counts.reusable, fresh: counts.toEvaluate })}
							parts={[
								{ key: 'reused', value: counts.reusable, className: 'bg-text-muted' },
								{ key: 'new', value: counts.toEvaluate, className: 'bg-action' }
							]}
						/>
					</div>
					<dl className="type-ui mt-3 space-y-1.5">
						<div className="flex items-baseline gap-2">
							<span aria-hidden className="bg-text-muted size-2.5 shrink-0 rounded-[3px]" />
							<dt className="min-w-0 flex-1">{t('rowReused')}</dt>
							<dd className="font-mono">
								<Count value={counts.reusable} />
							</dd>
						</div>
						<div className="flex items-baseline gap-2">
							<span aria-hidden className="bg-action size-2.5 shrink-0 rounded-[3px]" />
							<dt className="min-w-0 flex-1">{t('reuseNew')}</dt>
							<dd className="font-mono">
								<Count value={counts.toEvaluate} />
							</dd>
						</div>
					</dl>
					<p className="text-text-muted mt-2 text-xs">
						{counts.reusable > 0 ? t('rowReusedNote') : t('rowReusedNone')}
					</p>
				</div>
			</div>
		</section>
	)
}

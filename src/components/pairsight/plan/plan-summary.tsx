import { MIN_RECORDS, type EntityType } from '@/lib/pairsight/entity-types'
import { getTranslations } from 'next-intl/server'
import { EXACT_FORMATS } from '@/i18n/formats'
import { Link } from '@/i18n/routing'
import { InfoTip } from '@/components/ui/info-tip'
import { Count } from '@/components/ui/count'
import { thresholdPreset } from '@/lib/pairsight/decisions'
import type { PlanCounts } from '@/server/pairsight/plan'
import type { RunDuration } from '@/server/pairsight/run-estimate'
import type { SkipReason, SplinkState } from '@/server/pairsight/splink/picks'
import { cn } from '@/lib/cn'
import { Glyph } from '../glyph'
import { VendorSwatch } from '../vendor-swatch'

const LINK_CLASS =
	'text-text decoration-border-strong hover:decoration-text hit-area inline-flex min-h-11 items-center underline underline-offset-[3px] transition-[text-decoration-color] duration-150'

function mono(chunks: React.ReactNode) {
	return <strong className="text-text font-mono font-semibold">{chunks}</strong>
}

// One line of the summary: what it is, what it's set to, and the way to change it.
function Row({
	label,
	href,
	changeLabel,
	children
}: {
	label: string
	href: string
	changeLabel: string
	children: React.ReactNode
}) {
	return (
		<div className="border-border flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t py-[18px]">
			<dt className="text-text-muted flex-[0_0_200px]">{label}</dt>
			<dd className="min-w-0 flex-[1_1_300px]">{children}</dd>
			<dd>
				<Link href={href} className={LINK_CLASS} aria-label={`${changeLabel}: ${label}`}>
					{changeLabel}
				</Link>
			</dd>
		</div>
	)
}

// Check and start (pairsight-handoff Start): everything the run will use, one
// line each with the way to change it; beside it, the run itself (how many
// pairs, how many are new to Jev, roughly what it costs and how long it
// takes, and the way to start it), and what Jev is sent.
export async function PlanSummary({
	base,
	counts,
	entityType,
	fileName,
	vendors,
	identitySame,
	jevFieldCount,
	columnCount,
	threshold,
	splink,
	cost,
	duration,
	isOverLimit,
	start
}: {
	base: string
	counts: PlanCounts
	entityType: EntityType
	fileName: string
	vendors: Array<{ id: string; name: string; pairs: number }>
	identitySame: string
	jevFieldCount: number
	columnCount: number
	threshold: number
	// PairSight's suggestions (splink/picks.ts): whether they're in, coming, or not.
	splink: { state: SplinkState; reason: SkipReason | null }
	// The estimated cost as said: "About $0.42", or "Less than 1¢".
	cost: string
	// How long its new checks should take, padded (run-estimate.ts).
	duration: RunDuration
	isOverLimit: boolean
	// Start run, and in the demo the way to the run that exists.
	start: React.ReactNode
}) {
	const [t, tRules] = await Promise.all([getTranslations('Plan'), getTranslations('Rules')])
	const preset = thresholdPreset(threshold)
	const vendorInside = counts.vendorPairs - counts.addedByVendorOnly
	// Every pair already scored: nothing goes to Jev, so no cost or wait to show.
	const isAllReused = counts.uniquePairs > 0 && counts.toEvaluate === 0
	// Nothing new for Jev means nothing to wait for.
	const durationText =
		duration.unit === 'none' || duration.unit === 'underMinute'
			? t('takesUnderMinute')
			: duration.unit === 'minutes'
				? t('takesMinutes', { count: duration.value })
				: t('takesHours', { count: duration.value })
	const change = t('change')
	const card = 'bg-surface border-border min-w-0 rounded-lg border p-6 md:p-7'
	const onInverseLine = 'border-on-inverse/22'

	return (
		<section aria-labelledby="ledger-title" className="flex flex-wrap items-start gap-4">
			<h2 id="ledger-title" className="sr-only">
				{t('ledgerTitle')}
			</h2>
			<dl className={cn(card, 'flex-[2_1_560px] pt-3 text-base leading-6 md:pt-3')}>
				<Row label={t('summaryRecords')} href={`${base}/records`} changeLabel={change}>
					{t.rich(
						'summaryRecordsValue',
						{
							count: counts.records,
							type: entityType,
							file: fileName,
							n: mono,
							f: (chunks) => <span className="font-mono">{chunks}</span>
						},
						EXACT_FORMATS
					)}
				</Row>
				<Row label={t('summaryVendors')} href={`${base}/vendors`} changeLabel={change}>
					{vendors.map((vendor, index) => (
						<span key={vendor.id} className="flex items-center gap-2">
							<VendorSwatch index={index} />
							<span>
								{t.rich(
									'summaryVendor',
									{
										name: vendor.name,
										pairs: vendor.pairs,
										n: (chunks) => <span className="font-mono">{chunks}</span>
									},
									EXACT_FORMATS
								)}
							</span>
						</span>
					))}
				</Row>
				<Row label={t('summarySame')} href={`${base}/rules`} changeLabel={change}>
					{identitySame}
				</Row>
				<Row label={t('summaryValues')} href={`${base}/rules`} changeLabel={change}>
					{t.rich('summaryValuesValue', { count: jevFieldCount, total: columnCount, n: mono })}
				</Row>
				<Row label={t('summaryCutoff')} href={`${base}/rules`} changeLabel={change}>
					<strong className="text-text font-mono font-semibold">{threshold.toFixed(2)}</strong>
					{' · '}
					{preset == null ? tRules('thresholdCustom') : tRules(`threshold_${preset}`)}
				</Row>
				<Row label={t('summaryPairs')} href={`${base}/rules`} changeLabel={change}>
					<span className={cn(isOverLimit && 'text-danger')}>
						{splink.state === 'done'
							? t.rich(
									'summaryPairsValue',
									{
										total: counts.uniquePairs,
										suggested: counts.suggestedPairs,
										added: counts.addedByVendorOnly,
										n: mono
									},
									EXACT_FORMATS
								)
							: splink.state === 'waiting'
								? t.rich(
										'summaryPairsWaiting',
										{ total: counts.uniquePairs, n: mono },
										EXACT_FORMATS
									)
								: t.rich(
										'summaryPairsNoSuggestions',
										{ total: counts.uniquePairs, n: mono },
										EXACT_FORMATS
									)}
					</span>
					<InfoTip
						label={t('suggestionsInfoLabel')}
						content={t('suggestionsInfo', { type: entityType })}
					/>
					{splink.state !== 'done' && splink.state !== 'waiting' && (
						<span className="text-text-muted block text-sm">
							{splink.reason === 'too_few_records'
								? t('rowSuggestedTooFew', { min: MIN_RECORDS })
								: t('rowSuggestedFailed')}
						</span>
					)}
					{vendorInside > 0 && (
						<span className="text-text-muted block text-sm">
							{t('rowDuplicatesNote', { inside: vendorInside })}
						</span>
					)}
				</Row>
			</dl>

			<div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
				<section
					aria-labelledby="this-run-title"
					className="bg-inverse text-on-inverse border-inverse rounded-lg border p-6 md:p-7"
				>
					<h2 id="this-run-title" className="type-eyebrow opacity-70">
						{t('thisRun')}
					</h2>
					<p className="mt-3.5">
						<Count
							value={counts.uniquePairs}
							className="mr-1.5 font-mono text-[3.5rem] leading-none font-semibold tracking-[-0.03em]"
						/>
						{t('thisRunPairs', { count: counts.uniquePairs })}
					</p>
					<dl className={cn('mt-4 border-t text-base', onInverseLine)}>
						<div className={cn('flex justify-between gap-3 border-b py-3', onInverseLine)}>
							<dt>{t('runNew')}</dt>
							<dd className="font-mono font-semibold">
								<Count value={counts.toEvaluate} />
							</dd>
						</div>
						{counts.reusable > 0 && (
							<div className={cn('flex justify-between gap-3 border-b py-3', onInverseLine)}>
								<dt>{t('rowReused')}</dt>
								<dd className="font-mono font-semibold">
									<Count value={counts.reusable} />
								</dd>
							</div>
						)}
						{isAllReused ? null : (
							<>
								<div className={cn('flex justify-between gap-3 border-b py-3', onInverseLine)}>
									<dt className="flex items-center gap-1">
										{t('runCost')}
										<InfoTip label={t('estimateInfoLabel')} content={t('estimateInfo')} />
									</dt>
									<dd className="font-mono font-semibold">{cost}</dd>
								</div>
								<div className="flex justify-between gap-3 py-3">
									<dt>{t('runTakes')}</dt>
									<dd className="font-mono font-semibold">{durationText}</dd>
								</div>
							</>
						)}
					</dl>
					{/* Nothing new for Jev: say so, rather than a cost of $0.00. */}
					{isAllReused && <p className="mt-3 text-base">{t('runAllReused')}</p>}
					<div data-start-run className="mt-4 flex flex-wrap items-center gap-2">
						{start}
					</div>
					<p className="mt-3 text-sm opacity-75">{t('runBackground')}</p>
				</section>

				<section aria-labelledby="sent-title" className={card}>
					<h2 id="sent-title" className="text-text-muted type-eyebrow">
						{t('sentTitle')}
					</h2>
					<ul className="mt-3 text-base">
						<li className="border-border flex items-start gap-3 border-t py-3">
							<Glyph kind="check" className="size-6 text-[0.8125rem]" />
							<span>{t('sentValues', { count: jevFieldCount })}</span>
						</li>
						<li className="border-border flex items-start gap-3 border-t py-3">
							<Glyph kind="check" className="size-6 text-[0.8125rem]" />
							<span>{t('sentAnswers')}</span>
						</li>
						<li className="border-border flex items-start gap-3 border-t py-3">
							<Glyph kind="different" className="size-6 text-[0.8125rem]" />
							<span>{t('sentNever')}</span>
						</li>
					</ul>
				</section>
			</div>
		</section>
	)
}

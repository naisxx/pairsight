import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import type { PlanCounts } from '@/server/pairsight/plan'
import type { RunDuration } from '@/server/pairsight/run-estimate'
import { InfoTip } from '@/components/ui/info-tip'
import { Count } from '@/components/ui/count'

const PERCENT = 100

// "From records to pairs": every step from the source records to the unique
// pairs a run assesses, then how many are reused and how many are new.
export async function PlanLedger({
	counts,
	fileName,
	ruleMatches,
	ruleCount,
	cost,
	duration,
	isOverLimit
}: {
	counts: PlanCounts
	fileName: string
	// Rule matches before overlap: each rule's pairs, added up.
	ruleMatches: number
	ruleCount: number
	cost: string
	// How long its new checks should take, padded (run-estimate.ts).
	duration: RunDuration
	isOverLimit: boolean
}) {
	const t = await getTranslations('Plan')
	const overlaps = Math.max(0, ruleMatches - counts.blockedPairs)
	const vendorInside = counts.vendorPairs - counts.addedByVendorOnly
	const possible = counts.allPossiblePairs
	const percent = possible === 0 ? 0 : (counts.uniquePairs / possible) * PERCENT
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const rows = [
		{ label: t('rowRecords'), value: <Count value={counts.records} />, note: fileName },
		{ label: t('rowPossible'), value: <Count value={possible} />, note: t('rowPossibleNote') },
		// Read down, these add up: rule matches + vendor pairs − duplicates
		// = the unique pairs below.
		{
			label: t('rowRules'),
			value: <Count value={ruleMatches} />,
			note: t('rowRulesNote', { count: ruleCount })
		},
		{
			label: t('rowVendor'),
			value: (
				<>
					+<Count value={counts.vendorPairs} />
				</>
			),
			note: t('rowVendorNote')
		},
		{
			label: t('rowDuplicates'),
			value: (
				<>
					−<Count value={overlaps + vendorInside} />
				</>
			),
			note: t('rowDuplicatesNote', { overlaps, inside: vendorInside })
		}
	]
	return (
		<section aria-labelledby="ledger-title" className="border-border bg-surface rounded-md border">
			<header className="px-5 pt-4 pb-2">
				<h2 id="ledger-title" className="text-sm font-semibold">
					{t('ledgerTitle')}
				</h2>
			</header>
			{/* Each row: the term and its value on one line, a note under the term. */}
			<dl>
				{rows.map((row) => (
					<div
						key={row.label}
						className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t px-5 py-3"
					>
						<dt className="type-ui">{row.label}</dt>
						<dd className="font-mono text-[15px]">{row.value}</dd>
						<dd className="text-text-muted truncate text-xs">{row.note}</dd>
					</div>
				))}
				<div className="border-border bg-surface-muted flex items-baseline justify-between gap-4 border-t px-5 py-4">
					<dt className="text-sm font-semibold">{t('rowUnique')}</dt>
					<dd
						className={cn(
							'font-mono text-[28px] leading-none font-medium',
							isOverLimit && 'text-danger'
						)}
					>
						<Count value={counts.uniquePairs} />
						{!counts.isExact && '+'}
					</dd>
				</div>
				<div className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t px-5 py-3">
					<dt className="type-ui">{t('rowReused')}</dt>
					<dd className="font-mono text-[15px]">
						<Count value={counts.reusable} />
					</dd>
					<dd className="text-text-muted text-xs">
						{counts.reusable > 0 ? t('rowReusedNote') : t('rowReusedNone')}
					</dd>
				</div>
				<div className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t px-5 py-3">
					<dt className="type-ui font-medium">{t('rowNew')}</dt>
					<dd className="font-mono text-[15px] font-semibold">
						<Count value={counts.toEvaluate} />
						{!counts.isExact && '+'}
					</dd>
					<dd className="text-text-muted flex min-w-0 items-center gap-1 text-xs">
						<span className="truncate">
							{t('rowNewNote', { cost })}
							{counts.isExact && duration.unit !== 'none' && (
								<>
									{' · '}
									{duration.unit === 'underMinute'
										? t('takesUnderMinute')
										: duration.unit === 'minutes'
											? t('takesMinutes', { count: duration.value })
											: t('takesHours', { count: duration.value })}
								</>
							)}
						</span>
						<InfoTip label={t('estimateInfoLabel')} content={t('estimateInfo')} />
					</dd>
				</div>
			</dl>
			<div className="border-border border-t px-5 py-4">
				<div
					role="img"
					aria-label={t('coverageLabel', { total: counts.uniquePairs, possible })}
					className="bg-surface-muted flex h-2 overflow-hidden rounded-full"
				>
					<span className="bg-text h-full" style={{ width: `${Math.min(PERCENT, percent)}%` }} />
				</div>
				<p className="text-text-muted mt-2 text-xs">
					{t.rich('coverage', {
						total: counts.uniquePairs,
						possible,
						percent: percent.toFixed(0),
						rest: Math.max(0, possible - counts.uniquePairs),
						n: mono
					})}
				</p>
			</div>
		</section>
	)
}

import { getFormatter, getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import type { PlanCounts } from '@/server/pairsight/plan'

const PERCENT = 100

// "From records to pairs": every step from the source records to the unique
// pairs a run assesses, then how many are reused and how many are new.
export async function PlanLedger({
	counts,
	fileName,
	ruleMatches,
	ruleCount,
	cost,
	isOverLimit
}: {
	counts: PlanCounts
	fileName: string
	// Rule matches before overlap: each rule's pairs, added up.
	ruleMatches: number
	ruleCount: number
	cost: string
	isOverLimit: boolean
}) {
	const [t, format] = await Promise.all([getTranslations('Plan'), getFormatter()])
	const overlaps = Math.max(0, ruleMatches - counts.blockedPairs)
	const vendorInside = counts.vendorPairs - counts.addedByVendorOnly
	const possible = counts.allPossiblePairs
	const percent = possible === 0 ? 0 : (counts.uniquePairs / possible) * PERCENT
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const rows = [
		{ label: t('rowRecords'), value: format.number(counts.records), note: fileName },
		{ label: t('rowPossible'), value: format.number(possible), note: t('rowPossibleNote') },
		{
			label: t('rowRules'),
			value: format.number(counts.blockedPairs),
			note: t('rowRulesNote', { raw: ruleMatches, count: ruleCount })
		},
		{
			label: t('rowVendor'),
			value: `+${format.number(counts.addedByVendorOnly)}`,
			note: t('rowVendorNote')
		},
		{
			label: t('rowDuplicates'),
			value: format.number(overlaps + vendorInside),
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
			<dl>
				{rows.map((row) => (
					<div
						key={row.label}
						className="border-border flex items-baseline justify-between gap-4 border-t px-5 py-3"
					>
						<div className="min-w-0">
							<dt className="type-ui">{row.label}</dt>
							<dd className="text-text-muted truncate text-xs">{row.note}</dd>
						</div>
						<dd className="font-mono text-[15px]">{row.value}</dd>
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
						{format.number(counts.uniquePairs)}
					</dd>
				</div>
				<div className="border-border flex items-baseline justify-between gap-4 border-t px-5 py-3">
					<div>
						<dt className="type-ui">{t('rowReused')}</dt>
						<dd className="text-text-muted text-xs">
							{counts.reusable > 0 ? t('rowReusedNote') : t('rowReusedNone')}
						</dd>
					</div>
					<dd className="font-mono text-[15px]">{format.number(counts.reusable)}</dd>
				</div>
				<div className="border-border flex items-baseline justify-between gap-4 border-t px-5 py-3">
					<div>
						<dt className="type-ui font-medium">{t('rowNew')}</dt>
						<dd className="text-text-muted text-xs">{t('rowNewNote', { cost })}</dd>
					</div>
					<dd className="font-mono text-[15px] font-semibold">
						{format.number(counts.toEvaluate)}
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

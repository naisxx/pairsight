import { getFormatter, getTranslations } from 'next-intl/server'
import type { PlanCounts } from '@/server/pairsight/plan'
import { Section } from '../step-layout'

// Where the plan's pairs come from, ending in the two numbers that matter:
// unique pairs and new Jev evaluations.
export async function PlanBreakdown({
	counts,
	maxPairsPerRun
}: {
	counts: PlanCounts
	maxPairsPerRun: number
}) {
	const [t, format] = await Promise.all([getTranslations('Plan'), getFormatter()])
	const number = (value: number) => format.number(value)
	const reduction =
		counts.allPossiblePairs === 0
			? 0
			: Math.max(0, Math.round((1 - counts.uniquePairs / counts.allPossiblePairs) * 100))
	const rows: Array<{ label: string; value: number; isEmphasis?: boolean }> = [
		{ label: t('records'), value: counts.records },
		{ label: t('blocked'), value: counts.blockedPairs },
		{ label: t('vendorPairs'), value: counts.vendorPairs },
		{ label: t('addedByVendor'), value: counts.addedByVendorOnly },
		{ label: t('unique'), value: counts.uniquePairs, isEmphasis: true },
		{ label: t('reusable'), value: counts.reusable },
		{ label: t('toEvaluate'), value: counts.toEvaluate, isEmphasis: true }
	]
	return (
		<Section title={t('unique')}>
			<dl className="divide-border divide-y">
				{rows.map(({ label, value, isEmphasis }) => (
					<div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
						<dt
							className={isEmphasis ? 'text-text text-sm font-semibold' : 'text-text-muted text-sm'}
						>
							{label}
						</dt>
						<dd
							className={
								isEmphasis
									? 'text-text text-base font-semibold tabular-nums'
									: 'text-text text-sm tabular-nums'
							}
						>
							{number(value)}
						</dd>
					</div>
				))}
			</dl>
			<p className="text-text-muted mt-3 text-xs">
				{t('reduction', { percent: reduction, all: number(counts.allPossiblePairs) })} ·{' '}
				{t('limit', { limit: number(maxPairsPerRun) })}
			</p>
		</Section>
	)
}

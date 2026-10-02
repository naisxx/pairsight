import { useTranslations } from 'next-intl'
import { Panel } from '@/components/ui/panel'
import type { OverlapGroup } from '@/lib/pairsight/metrics'

const PERCENT = 100
const MAX_INSIGHTS = 3

// Judged pairs grouped by which of two vendors matched them, and how often
// PairSight judged each group the same individual: what each vendor's extra
// matches are worth, and what both missed.
export function VendorOverlap({
	first,
	second,
	groups,
	className
}: {
	first: string
	second: string
	groups: OverlapGroup[]
	className?: string
}) {
	const t = useTranslations('Overview')
	const largest = Math.max(1, ...groups.map((group) => group.total))
	const byKey = Object.fromEntries(groups.map((group) => [group.key, group]))
	const label = (key: OverlapGroup['key']) =>
		key === 'both'
			? t('overlapBoth', { first, second })
			: key === 'firstOnly'
				? t('overlapOnly', { vendor: first })
				: key === 'secondOnly'
					? t('overlapOnly', { vendor: second })
					: t('overlapNeither')

	const insights: string[] = []
	const secondOnly = byKey.secondOnly
	const firstOnly = byKey.firstOnly
	const neither = byKey.neither
	const both = byKey.both
	if (secondOnly != null && secondOnly.total > 0) {
		insights.push(
			t('overlapExtra', {
				vendor: second,
				same: secondOnly.sameIndividual,
				total: secondOnly.total
			})
		)
	}
	if (firstOnly != null && firstOnly.total > 0) {
		insights.push(
			t('overlapExtra', { vendor: first, same: firstOnly.sameIndividual, total: firstOnly.total })
		)
	}
	if (neither != null && neither.sameIndividual > 0) {
		insights.push(t('overlapMissedByBoth', { count: neither.sameIndividual }))
	}
	if (both != null && both.total > 0) {
		insights.push(
			t('overlapAgree', { percent: Math.round((both.sameIndividual / both.total) * PERCENT) })
		)
	}

	return (
		<Panel
			id="overlap"
			title={t('overlapTitle')}
			description={t('overlapDescription')}
			className={className}
		>
			<ul className="flex flex-col gap-3">
				{groups.map((group) => (
					<li key={group.key}>
						<div className="type-ui flex items-baseline justify-between gap-3">
							<span className="font-medium">{label(group.key)}</span>
							<span className="text-text-muted text-xs">
								{t.rich('overlapCount', {
									same: group.sameIndividual,
									total: group.total,
									n: (chunks) => <span className="text-text font-mono">{chunks}</span>
								})}
							</span>
						</div>
						<div
							role="img"
							aria-label={t('overlapBarLabel', {
								group: label(group.key),
								total: group.total,
								same: group.sameIndividual
							})}
							className="bar-wipe bg-surface-muted mt-1.5 flex h-2.5 overflow-hidden rounded-full"
						>
							<span
								className="bg-text h-full transition-[width] duration-300 ease-out"
								style={{ width: `${(group.sameIndividual / largest) * PERCENT}%` }}
							/>
							<span
								className="bg-border-input h-full transition-[width] duration-300 ease-out"
								style={{
									width: `${((group.total - group.sameIndividual) / largest) * PERCENT}%`
								}}
							/>
						</div>
					</li>
				))}
			</ul>
			<ul aria-hidden className="text-text-muted mt-3 flex gap-4 text-xs">
				<li className="flex items-center gap-1.5">
					<span className="bg-text size-2 rounded-full" />
					{t('sameIndividual')}
				</li>
				<li className="flex items-center gap-1.5">
					<span className="bg-border-input size-2 rounded-full" />
					{t('differentIndividuals')}
				</li>
			</ul>
			{insights.length > 0 && (
				<ul className="border-border text-text-muted mt-3 flex flex-col gap-1 border-t pt-3 text-xs leading-relaxed">
					{insights.slice(0, MAX_INSIGHTS).map((insight) => (
						<li key={insight}>{insight}</li>
					))}
				</ul>
			)}
		</Panel>
	)
}

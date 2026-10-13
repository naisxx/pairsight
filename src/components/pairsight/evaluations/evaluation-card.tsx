import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Count } from '@/components/ui/count'
import { ArrowRightIcon } from '@/components/ui/icons'
import { EXACT_FORMATS } from '@/i18n/formats'
import { rankVendors } from '@/lib/pairsight/ranking'
import type { FinishedEvaluation } from '@/server/pairsight/dashboard'
import { formatShare } from '../results/overview/chart-theme'
import { VendorSwatch } from '../vendor-swatch'

const PERCENT = 100
// The bar fills match the swatches' colours.
const BAR_COLOURS = ['bg-series-a', 'bg-series-b', 'bg-text-muted']

// One finished evaluation on the dashboard (pairsight-handoff Home): what it
// holds, each vendor's overall score best first (ranking.ts, as Results ranks
// them), and the way into each vendor's disagreements and the results.
export function EvaluationCard({ evaluation }: { evaluation: FinishedEvaluation }) {
	const t = useTranslations('Evaluations')
	const tTypes = useTranslations('EntityTypes')
	const format = useFormatter()
	const { run } = evaluation
	const ranked = rankVendors(evaluation.vendors)
	const checked = ranked[0]?.metrics.assessed ?? 0
	const titleId = `evaluation-${evaluation.evaluationId}`
	// Its colour on every screen: its place in the upload order.
	const colourOf = (id: string) =>
		Math.max(
			0,
			evaluation.vendors.findIndex((vendor) => vendor.id === id)
		)
	// Each vendor's disagreements, marked with its colour so the counts read
	// against the rows above without repeating the names.
	const disagreements = ranked.map(({ id, name, metrics }) => {
		const missed = metrics.counts.pairsight_only
		const merged = metrics.counts.vendor_only
		return (
			<Link
				key={id}
				href={`${evaluation.resultsHref}?vendor=${id}&tab=detailed&category=disagreements`}
				aria-label={t('disagreementsFor', { count: missed + merged, vendor: name })}
				// The split on hover: possibly missed, possibly wrong merges.
				title={t('disagreementsDetail', { missed, merged }, EXACT_FORMATS)}
				className="text-text hit-area decoration-border-strong hover:decoration-text inline-flex items-baseline gap-1.5 font-mono font-semibold underline-offset-[3px] hover:underline"
			>
				{ranked.length > 1 && <VendorSwatch index={colourOf(id)} className="translate-y-px" />}
				<Count value={missed + merged} />
			</Link>
		)
	})
	const single = ranked[0]
	const disagreementCount =
		ranked.length === 1 && single != null
			? single.metrics.counts.pairsight_only + single.metrics.counts.vendor_only
			: ranked.length

	return (
		<section
			aria-labelledby={titleId}
			className="bg-surface border-border flex min-w-0 flex-[1_1_340px] flex-col rounded-lg border p-7 text-base"
		>
			{evaluation.entityType != null && (
				<p className="text-text-muted type-eyebrow">
					{tTypes('name', { type: evaluation.entityType })}
				</p>
			)}
			<h2
				id={titleId}
				className="font-display mt-2.5 text-[1.625rem] leading-[1.05] font-semibold tracking-[-0.025em]"
			>
				<Link href={evaluation.resultsHref} className="hover:underline">
					{evaluation.evaluationName}
				</Link>
			</h2>
			{/* Two set lines, never a wrap: what it holds, then when it ran. */}
			<p className="text-text-muted mt-2 font-mono text-sm">
				<span className="block truncate">
					{t('cardMeta', { records: evaluation.recordCount ?? 0, checked }, EXACT_FORMATS)}
				</span>
				<span className="block truncate">
					{t('cardRunDate', {
						date:
							run.completedAt == null
								? '—'
								: format.dateTime(run.completedAt, { dateStyle: 'medium' })
					})}
				</span>
			</p>
			<ul aria-label={t('latestCaption')} className="mt-5">
				{ranked.map(({ id, name, metrics }) => {
					const colour = colourOf(id)
					return (
						<li key={id} className="border-border flex items-center gap-3 border-t py-2.5">
							{/* One line: the bar gives way first, then the name truncates. */}
							<span className="flex min-w-0 flex-[0_1_auto] items-baseline gap-2">
								<VendorSwatch index={colour} className="translate-y-px" />
								<span className="truncate" title={name}>
									{name}
								</span>
							</span>
							<span
								aria-hidden
								className="bg-border ml-auto h-1.5 max-w-[120px] min-w-10 flex-[1_1_0] overflow-hidden rounded-full"
							>
								<span
									className={`block h-full ${BAR_COLOURS[colour % BAR_COLOURS.length]}`}
									style={{ width: `${(metrics.f1 ?? 0) * PERCENT}%` }}
								/>
							</span>
							<span className="flex-[0_0_64px] text-right font-mono font-semibold tracking-[-0.03em]">
								<span className="sr-only">{t('colF1')}: </span>
								{formatShare(metrics.f1, '—')}
							</span>
						</li>
					)
				})}
			</ul>
			<p className="text-text-body border-border mt-4 mb-6 border-t pt-4">
				{format.list(disagreements, { type: 'conjunction' })}{' '}
				{t('cardDisagreements', { count: disagreementCount })}
			</p>
			<Button asChild cap={<ArrowRightIcon />} className="mt-auto self-start">
				<Link href={evaluation.resultsHref} aria-describedby={titleId}>
					{t('openResults')}
				</Link>
			</Button>
		</section>
	)
}

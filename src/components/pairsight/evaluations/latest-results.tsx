import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { ArrowRightIcon, SuccessIcon } from '@/components/ui/icons'
import type { LatestResults as LatestResultsData } from '@/server/pairsight/dashboard'
import { formatShare, MUTED_SERIES, VENDOR_SERIES } from '../results/overview/chart-theme'

const PERCENT = 100
const EYEBROW_ICON_SIZE = 14
const ARROW_SIZE = 14

function MetricBar({
	value,
	color,
	emptyLabel
}: {
	value: number | null
	color: string
	emptyLabel: string
}) {
	return (
		<span className="flex items-center gap-2">
			<span
				aria-hidden
				className="bg-surface-muted relative h-1.5 w-full min-w-[60px] rounded-full"
			>
				<span
					className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out"
					style={{ width: `${(value ?? 0) * PERCENT}%`, background: color }}
				/>
			</span>
			<span className="w-[52px] shrink-0 text-right font-mono">
				{formatShare(value, emptyLabel)}
			</span>
		</span>
	)
}

// The most recently finished run: precision, recall and F1 per vendor, and
// the way into its disagreements.
export function LatestResults({ latest }: { latest: LatestResultsData }) {
	const t = useTranslations('Evaluations')
	const format = useFormatter()
	const { run } = latest
	const first = latest.vendors[0]?.metrics
	const base = `/evaluations/${latest.evaluationId}/runs/${run.id}/results`
	const disagreements = first == null ? 0 : first.counts.pairsight_only + first.counts.vendor_only
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>

	return (
		<section
			aria-labelledby="latest-title"
			className="border-border bg-surface h-full overflow-hidden rounded-md border"
		>
			<div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
				<div className="min-w-0">
					<p className="text-text-muted flex items-center gap-1.5 text-xs font-medium">
						<SuccessIcon size={EYEBROW_ICON_SIZE} variant="solid" className="text-success" />
						{t('latestEyebrow')}
					</p>
					<h2 id="latest-title" className="mt-1 truncate text-lg font-semibold tracking-[-0.01em]">
						{latest.evaluationName}
					</h2>
					<p className="text-text-muted mt-0.5 text-xs">
						{t.rich('latestMeta', {
							number: run.number,
							when:
								run.completedAt == null
									? '—'
									: format.dateTime(run.completedAt, { dateStyle: 'medium', timeStyle: 'short' }),
							assessed: first?.assessed ?? 0,
							total: first?.total ?? 0,
							threshold: run.threshold.toFixed(2),
							n: mono
						})}
					</p>
				</div>
				<Chip>{t('latestChip')}</Chip>
			</div>

			<div className="mt-4 overflow-x-auto px-5">
				<table className="type-ui w-full min-w-[560px]">
					<caption className="sr-only">{t('latestCaption')}</caption>
					<thead>
						<tr className="text-text-muted text-left text-xs">
							<th scope="col" className="pb-2 font-medium">
								{t('colVendor')}
							</th>
							<th scope="col" className="w-[28%] pb-2 font-medium">
								{t('colPrecision')}
							</th>
							<th scope="col" className="w-[28%] pb-2 font-medium">
								{t('colRecall')}
							</th>
							<th scope="col" className="pb-2 text-right font-medium">
								{t('colF1')}
							</th>
							<th scope="col" className="pb-2 text-right font-medium">
								{t('colDisagreements')}
							</th>
						</tr>
					</thead>
					<tbody>
						{latest.vendors.map(({ id, name, metrics }, index) => {
							const color = VENDOR_SERIES[index] ?? MUTED_SERIES
							const missed = metrics.counts.pairsight_only
							const merged = metrics.counts.vendor_only
							return (
								<tr key={id} className="border-border border-t">
									<th scope="row" className="py-2.5 pr-3 text-left font-medium">
										<span className="inline-flex items-center gap-2 whitespace-nowrap">
											<span
												aria-hidden
												className="size-2.5 rounded-[3px]"
												style={{ background: color }}
											/>
											{name}
										</span>
									</th>
									<td className="py-2.5 pr-4">
										<MetricBar value={metrics.precision} color={color} emptyLabel="—" />
									</td>
									<td className="py-2.5 pr-4">
										<MetricBar value={metrics.recall} color={color} emptyLabel="—" />
									</td>
									<td className="py-2.5 text-right font-mono">{formatShare(metrics.f1, '—')}</td>
									<td className="py-2.5 text-right whitespace-nowrap">
										<Link
											href={`${base}?vendor=${id}&tab=detailed&category=disagreements`}
											aria-label={t('disagreementsFor', { count: missed + merged, vendor: name })}
											className="text-accent-ink font-mono hover:underline"
										>
											{missed + merged}
										</Link>
										<span className="text-text-muted type-caption ml-1">
											{t('disagreementsDetail', { missed, merged })}
										</span>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			<div className="border-border bg-surface-muted mt-4 flex flex-wrap items-center gap-3 border-t px-5 py-3">
				<p className="type-ui text-text-muted">
					{t.rich('latestSummary', { count: disagreements, n: mono })}
					{first != null && first.counts.incomplete > 0 && (
						<>
							{' · '}
							{t.rich('latestIncomplete', { count: first.counts.incomplete, n: mono })}
						</>
					)}
				</p>
				<div className="ml-auto flex gap-2">
					{disagreements > 0 && latest.vendors[0] != null && (
						<Button variant="secondary" size="sm" asChild>
							<Link
								href={`${base}?vendor=${latest.vendors[0].id}&tab=detailed&category=disagreements`}
							>
								{t('reviewDisagreements')}
							</Link>
						</Button>
					)}
					<Button size="sm" asChild>
						<Link href={base}>
							{t('openResults')}
							<ArrowRightIcon size={ARROW_SIZE} />
						</Link>
					</Button>
				</div>
			</div>
		</section>
	)
}

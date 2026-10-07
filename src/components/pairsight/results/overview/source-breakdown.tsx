import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Panel } from '@/components/ui/panel'
import type { ResultCategory } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'
import type { SourceRow } from '@/server/pairsight/result-overview'
import { CATEGORY_STYLES } from '../../result-parts'
import { Count } from '@/components/ui/count'
import { InfoTip } from '@/components/ui/info-tip'

const ORDER: ResultCategory[] = [
	'both_matched',
	'pairsight_only',
	'vendor_only',
	'neither_matched',
	'incomplete'
]
const PERCENT = 100

// Where each kind of pair came from — suggested by PairSight, or added
// because a vendor matched it — as one stacked bar per source on a shared
// scale. A source opens its pairs in the detailed view.
export function SourceBreakdown({
	sources,
	sourceHrefs,
	className
}: {
	sources: SourceRow[]
	sourceHrefs: { suggested: string; vendor: string }
	className?: string
}) {
	const t = useTranslations('Overview')
	const largest = Math.max(1, ...sources.map((source) => source.total))

	return (
		<Panel
			id="sources"
			title={t('sourcesTitle')}
			description={t('sourcesDescription')}
			actions={<InfoTip label={t('sourcesInfoLabel')} content={t('sourcesFootnote')} />}
			className={className}
		>
			<ul className="flex flex-col gap-2.5">
				{sources.map((source) => {
					const label = source.suggested ? t('suggestedByPairSight') : t('addedByVendor')
					const disagreements = source.counts.pairsight_only + source.counts.vendor_only
					return (
						<li key={source.suggested ? 'suggested' : 'vendor'}>
							<Link
								href={source.suggested ? sourceHrefs.suggested : sourceHrefs.vendor}
								aria-label={t('sourceLabel', {
									source: label,
									total: source.total,
									disagreements
								})}
								className="group hover:bg-surface-hover -mx-1.5 block w-[calc(100%+12px)] rounded-sm px-1.5 py-1 text-left transition-colors duration-150"
							>
								<span className="flex items-baseline justify-between gap-2 text-xs">
									<span className="text-text min-w-0">{label}</span>
									<span className="text-text-muted shrink-0">
										<Count value={source.total} className="text-text font-mono" />
										{disagreements > 0 && (
											<>
												{' · '}
												{t.rich('sourceDisagree', {
													count: disagreements,
													n: (chunks) => <span className="text-text font-mono">{chunks}</span>
												})}
											</>
										)}
									</span>
								</span>
								<span
									aria-hidden
									className="bar-wipe bg-surface-muted mt-1 flex h-2 overflow-hidden rounded-full"
								>
									{ORDER.map((category) =>
										source.counts[category] === 0 ? null : (
											<span
												key={category}
												className={cn(
													'h-full transition-[width] duration-300 ease-out',
													category === 'incomplete'
														? 'bg-border-input'
														: CATEGORY_STYLES[category].fill
												)}
												style={{ width: `${(source.counts[category] / largest) * PERCENT}%` }}
											/>
										)
									)}
								</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</Panel>
	)
}

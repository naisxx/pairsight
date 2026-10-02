import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Panel } from '@/components/ui/panel'
import type { ResultCategory } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'
import type { SourceRow } from '@/server/pairsight/result-overview'
import { CATEGORY_STYLES } from '../../result-parts'

const ORDER: ResultCategory[] = [
	'both_matched',
	'pairsight_only',
	'vendor_only',
	'neither_matched',
	'incomplete'
]
const PERCENT = 100

// Which rules surfaced each kind of pair, as one stacked bar per rule on a
// shared scale. A rule opens its kind of pair (from rules, or added by a
// vendor) in the detailed view.
export function SourceBreakdown({
	sources,
	ruleLabels,
	sourceHrefs,
	className
}: {
	sources: SourceRow[]
	ruleLabels: Record<string, string>
	sourceHrefs: { rules: string; vendor: string }
	className?: string
}) {
	const t = useTranslations('Overview')
	const largest = Math.max(1, ...sources.map((source) => source.total))

	return (
		<Panel
			id="sources"
			title={t('sourcesTitle')}
			description={t('sourcesDescription')}
			className={className}
		>
			<ul className="flex flex-col gap-2.5">
				{sources.map((source) => {
					const isVendor = source.ruleId == null
					const label = isVendor
						? t('addedByVendor')
						: (ruleLabels[source.ruleId ?? ''] ?? source.ruleId ?? '')
					const disagreements = source.counts.pairsight_only + source.counts.vendor_only
					return (
						<li key={source.ruleId ?? 'vendor'}>
							<Link
								href={isVendor ? sourceHrefs.vendor : sourceHrefs.rules}
								aria-label={t('sourceLabel', { source: label, total: source.total, disagreements })}
								className="group hover:bg-surface-hover -mx-1.5 block w-[calc(100%+12px)] rounded-sm px-1.5 py-1 text-left transition-colors duration-150"
							>
								<span className="flex items-baseline justify-between gap-2 text-xs">
									<span className={cn('text-text truncate', isVendor && 'italic')}>{label}</span>
									<span className="text-text-muted shrink-0">
										<span className="text-text font-mono">{source.total}</span>
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
			<p className="text-text-muted type-caption mt-3 leading-relaxed">{t('sourcesFootnote')}</p>
		</Panel>
	)
}

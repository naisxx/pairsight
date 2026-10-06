import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Panel } from '@/components/ui/panel'
import type { ResultCategory } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'
import type { HardCases, SourceRow } from '@/server/pairsight/result-overview'
import { CATEGORY_STYLES } from '../../result-parts'
import { Count } from '@/components/ui/count'
import { InfoTip } from '@/components/ui/info-tip'
import { ScrollArea } from '@/components/ui/scroll-area'

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
	hardCases,
	vendors,
	className
}: {
	sources: SourceRow[]
	ruleLabels: Record<string, string>
	sourceHrefs: { rules: string; fuzzy: string; vendor: string }
	hardCases: HardCases
	vendors: ReadonlyArray<{ id: string; name: string }>
	className?: string
}) {
	const t = useTranslations('Overview')
	const largest = Math.max(1, ...sources.map((source) => source.total))

	return (
		<Panel
			id="sources"
			title={t('sourcesTitle')}
			description={t('sourcesDescription')}
			// What the numbers mean, and the hard-to-spot duplicates: in the
			// header, so they're seen without scrolling the list.
			actions={
				<InfoTip
					label={t('sourcesInfoLabel')}
					content={
						<>
							{hardCases.found > 0 && <HardCasesNote hardCases={hardCases} vendors={vendors} />}
							<p className="text-text-muted">{t('sourcesFootnote')}</p>
						</>
					}
				/>
			}
			// One row per rule plus the hard cases: it scrolls inside the height
			// its neighbours set rather than stretching them.
			className={cn('flex flex-col', className)}
			bodyClassName="flex min-h-0 flex-1 flex-col p-0"
		>
			<ScrollArea label={t('sourcesTitle')} fillRow className="px-4 pt-2 pb-4">
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
									aria-label={t('sourceLabel', {
										source: label,
										total: source.total,
										disagreements
									})}
									className="group hover:bg-surface-hover -mx-1.5 block w-[calc(100%+12px)] rounded-sm px-1.5 py-1 text-left transition-colors duration-150"
								>
									<span className="flex items-baseline justify-between gap-2 text-xs">
										<span className={cn('text-text min-w-0', isVendor && 'italic')}>{label}</span>
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
			</ScrollArea>
			{hardCases.found > 0 && (
				<Link
					href={sourceHrefs.fuzzy}
					className="text-action border-border block truncate border-t px-4 py-2.5 text-xs font-medium hover:underline"
				>
					{t('hardCasesSee', { count: hardCases.found })}
				</Link>
			)}
		</Panel>
	)
}

// What only the fuzzy rules found, and who caught it: the hard cases a
// comparison on exact rules alone would never have shown. Read in the
// header's (i).
function HardCasesNote({
	hardCases,
	vendors
}: {
	hardCases: HardCases
	vendors: ReadonlyArray<{ id: string; name: string }>
}) {
	const t = useTranslations('Overview')
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	return (
		<div className="mb-2">
			<p className="font-medium">{t('hardCasesTitle')}</p>
			<p className="text-text-muted mt-1">
				{t.rich('hardCases', { confirmed: hardCases.confirmed, found: hardCases.found, n: mono })}
				{hardCases.confirmed > 0 &&
					vendors.map((vendor) => (
						<span key={vendor.id}>
							{' · '}
							{t.rich('hardCasesVendor', {
								vendor: vendor.name,
								caught: hardCases.byVendor.find((entry) => entry.id === vendor.id)?.caught ?? 0,
								n: mono
							})}
						</span>
					))}
			</p>
		</div>
	)
}

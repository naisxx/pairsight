import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { ArrowRightIcon } from '@/components/ui/icons'
import { Panel } from '@/components/ui/panel'
import type { Category } from '@/lib/pairsight/decisions'
import type { ResultRow } from '@/server/pairsight/results'
import { CategoryDot, ScoreBar } from '../../result-parts'

const MINI_BAR_WIDTH_PX = 44

function DisagreementGroup({
	title,
	hint,
	rows,
	category,
	threshold,
	pairHref
}: {
	title: string
	hint: string
	rows: ResultRow[]
	category: Category
	threshold: number
	pairHref: (pairId: string) => { pathname: string; query: Record<string, string> }
}) {
	const t = useTranslations('Overview')
	return (
		<div>
			<h3 className="text-text flex items-center gap-1.5 text-xs font-medium">
				<CategoryDot category={category} className="size-2" />
				{title}
			</h3>
			<p className="text-text-muted type-caption">{hint}</p>
			{rows.length === 0 ? (
				<p className="text-text-muted mt-2 text-xs">{t('noneAtThreshold')}</p>
			) : (
				<ul className="-mx-2 mt-1.5">
					{rows.map((row) => (
						<li key={row.id}>
							<Link
								href={pairHref(row.id)}
								className="group hover:bg-surface-hover flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors duration-150"
							>
								<span className="min-w-0 flex-1">
									<span className="text-text type-ui block truncate">
										{row.recordA.label} <span className="text-text-muted">↔</span>{' '}
										{row.recordB.label}
									</span>
									<span className="text-text-muted block font-mono text-[0.6875rem]">
										{row.recordA.reference} · {row.recordB.reference}
									</span>
								</span>
								{row.score != null && (
									<ScoreBar score={row.score} threshold={threshold} width={MINI_BAR_WIDTH_PX} />
								)}
								<ArrowRightIcon
									size={13}
									className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
								/>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

// Where to start: the duplicates the vendor missed that Jev is surest about,
// and the vendor's merges Jev is least sure of.
export function TopDisagreements({
	vendorName,
	threshold,
	missed,
	merges,
	pairHref,
	className
}: {
	vendorName: string
	threshold: number
	missed: ResultRow[]
	merges: ResultRow[]
	pairHref: (pairId: string) => { pathname: string; query: Record<string, string> }
	className?: string
}) {
	const t = useTranslations('Overview')

	return (
		<Panel id="top" title={t('topTitle')} description={t('topDescription')} className={className}>
			<div className="flex flex-col gap-4">
				<DisagreementGroup
					threshold={threshold}
					pairHref={pairHref}
					title={t('topMissed', { vendor: vendorName })}
					hint={t('topMissedHint')}
					rows={missed}
					category="pairsight_only"
				/>
				<DisagreementGroup
					threshold={threshold}
					pairHref={pairHref}
					title={t('topMerges', { vendor: vendorName })}
					hint={t('topMergesHint')}
					rows={merges}
					category="vendor_only"
				/>
			</div>
		</Panel>
	)
}

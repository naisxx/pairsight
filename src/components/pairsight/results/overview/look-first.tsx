import { LOW_CONFIDENCE_BAND } from '@/lib/pairsight/decisions'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { ArrowRightIcon } from '@/components/ui/icons'
import { Panel } from '@/components/ui/panel'
import { PreviewNote } from '../preview-note'
import type { Category } from '@/lib/pairsight/decisions'
import type { Workload } from '@/lib/pairsight/metrics'
import { Count } from '@/components/ui/count'
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

// Where to start (merges what used to be "What's left to look at?"): the
// close calls as the headline, the disagreements and unchecked pairs as
// links, then the duplicates the vendor missed that Jev is surest about and
// the vendor's merges Jev is least sure of.
export function LookFirst({
	vendorName,
	threshold,
	missed,
	merges,
	workload,
	hrefs,
	pairHref,
	className
}: {
	vendorName: string
	threshold: number
	missed: ResultRow[]
	merges: ResultRow[]
	workload: Workload
	hrefs: { disagreements: string; near: string; incomplete: string }
	pairHref: (pairId: string) => { pathname: string; query: Record<string, string> }
	className?: string
}) {
	const t = useTranslations('Overview')

	return (
		<Panel id="top" title={t('topTitle')} description={t('topDescription')} className={className}>
			<PreviewNote runThreshold={threshold} message="panel" className="-mt-2 mb-4" />
			<div className="border-border grid grid-cols-1 gap-4 border-b pb-5 @xl:grid-cols-2">
				<Link
					href={hrefs.near}
					className="group hover:bg-surface-hover -m-2 flex flex-col rounded-md p-2 transition-colors duration-150"
				>
					<Count
						value={workload.nearThreshold}
						className="text-accent-ink font-mono text-4xl leading-none font-medium tracking-[-0.03em]"
					/>
					<span className="text-text type-ui mt-1.5 flex items-center gap-1 font-medium">
						{t('workloadNear')}
						<ArrowRightIcon
							size={13}
							className="text-text-muted transition-transform duration-150 group-hover:translate-x-0.5"
						/>
					</span>
					<span className="text-text-muted text-xs">
						{t('workloadNearDetail', { band: LOW_CONFIDENCE_BAND.toFixed(2) })}
					</span>
				</Link>
				<ul className="@xl:border-border flex flex-col justify-center gap-0.5 @xl:border-l @xl:pl-4">
					<li>
						<Link
							href={hrefs.disagreements}
							className="group hover:bg-surface-hover flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors duration-150"
						>
							<Count
								value={workload.disagreements}
								className="w-12 shrink-0 font-mono font-medium"
							/>
							<span className="min-w-0 flex-1">
								<span className="text-text type-ui block font-medium">
									{t('workloadDisagreements')}
								</span>
								<span className="text-text-muted block text-xs">
									{t('workloadDisagreementsDetail', {
										pairsight: workload.pairsightOnly,
										vendor: workload.vendorOnly
									})}
								</span>
							</span>
						</Link>
					</li>
					{workload.incomplete > 0 && (
						<li>
							<Link
								href={hrefs.incomplete}
								className="group hover:bg-surface-hover flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors duration-150"
							>
								<Count
									value={workload.incomplete}
									className="w-12 shrink-0 font-mono font-medium"
								/>
								<span className="min-w-0 flex-1">
									<span className="text-text type-ui block font-medium">
										{t('workloadIncomplete')}
									</span>
									<span className="text-text-muted block text-xs">
										{t('workloadIncompleteDetail')}
									</span>
								</span>
							</Link>
						</li>
					)}
				</ul>
			</div>
			<div className="mt-5 grid grid-cols-1 gap-5 @2xl:grid-cols-2">
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
			{workload.disagreements > 0 && (
				<Link
					href={hrefs.disagreements}
					className="text-accent-ink type-ui hit-area mt-5 inline-flex items-center gap-1.5 font-medium hover:underline"
				>
					{t('lookAtAll', { count: workload.disagreements })}
					<ArrowRightIcon size={13} />
				</Link>
			)}
		</Panel>
	)
}

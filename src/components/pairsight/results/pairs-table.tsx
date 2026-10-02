import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Chip } from '@/components/ui/chip'
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ChevronsUpDownIcon,
	MinusIcon
} from '@/components/ui/icons'
import { failureReason } from '@/lib/pairsight/failure-reasons'
import { cn } from '@/lib/cn'
import { isPairsightMatch } from '@/server/pairsight/decisions'
import type { ResultFilters, ResultRow } from '@/server/pairsight/results'
import { RetryPairButton } from '../pair/retry-pair-button'
import { ReadOnlyGate } from '../read-only'
import { CategoryBadge, ScoreBar } from '../result-parts'
import { toQuery } from './query'

const SORT_ICON_SIZE = 12
const NEXT_SORT: Record<'none' | 'score-desc' | 'score-asc', ResultFilters['sort']> = {
	none: 'score-desc',
	'score-desc': 'score-asc',
	'score-asc': undefined
}

// The current page of pairs (docs/PairSight-UX-Plan.md §4.1). Each row is
// one link to its pair; incomplete rows show their status where a score
// would be and "not assessed" as the decision — never "no match". The table
// scrolls inside its frame so the header stays in view.
export function PairsTable({
	runId,
	base,
	filters,
	rows,
	threshold,
	vendorName,
	ruleLabels
}: {
	runId: string
	base: string
	filters: ResultFilters
	rows: ResultRow[]
	threshold: number
	vendorName: string
	ruleLabels: Record<string, string>
}) {
	const t = useTranslations('Results')
	const tFailures = useTranslations('Failures')
	const sort = filters.sort ?? 'none'
	const listQuery = { ...filters, tab: 'detailed' as const, sel: undefined }
	const sortHref = {
		pathname: `${base}/results`,
		query: toQuery(filters, { sort: NEXT_SORT[sort], page: undefined })
	}
	const th =
		'border-border text-text-muted h-9 border-b px-3 text-left text-xs font-medium whitespace-nowrap'
	const td = 'border-border h-12 border-b px-3 align-middle'

	return (
		<div
			data-pairs-table
			className="border-border bg-surface max-h-[calc(100dvh-300px)] min-h-[320px] overflow-auto rounded-t-md border border-b-0"
		>
			<table className="type-ui w-full border-separate border-spacing-0 lg:min-w-[1180px]">
				<caption className="sr-only">{t('tableCaption')}</caption>
				<thead className="bg-surface-muted sticky top-0 z-10">
					<tr>
						<th scope="col" className={th}>
							{t('columnCategory')}
						</th>
						<th scope="col" className={th}>
							{t('columnRecordA')}
						</th>
						<th scope="col" className={th}>
							{t('columnRecordB')}
						</th>
						<th scope="col" className={cn(th, 'hidden lg:table-cell')}>
							{t('columnVendorDecision', { vendor: vendorName })}
						</th>
						<th
							scope="col"
							className={th}
							aria-sort={
								sort === 'score-desc' ? 'descending' : sort === 'score-asc' ? 'ascending' : 'none'
							}
						>
							<Link
								href={sortHref}
								className="hover:text-text inline-flex items-center gap-1 rounded-[4px]"
							>
								{t('columnScore')}
								{sort === 'score-desc' ? (
									<ChevronDownIcon size={SORT_ICON_SIZE} />
								) : sort === 'score-asc' ? (
									<ChevronUpIcon size={SORT_ICON_SIZE} />
								) : (
									<ChevronsUpDownIcon size={SORT_ICON_SIZE} />
								)}
							</Link>
						</th>
						<th scope="col" className={cn(th, 'hidden md:table-cell')}>
							{t('columnDecision')}
						</th>
						<th scope="col" className={cn(th, 'hidden xl:table-cell')}>
							{t('columnReason')}
						</th>
						<th scope="col" className={cn(th, 'hidden lg:table-cell')}>
							{t('columnAssessment')}
						</th>
						<th scope="col" className={cn(th, 'hidden md:table-cell')}>
							{t('columnFlags')}
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const isSelected = row.id === filters.sel
						const reason =
							row.ruleIds.length === 0
								? t('reasonVendor', { vendor: vendorName })
								: t('reasonRules', {
										rules: row.ruleIds.map((ruleId) => ruleLabels[ruleId] ?? ruleId).join(', ')
									})
						return (
							<tr
								key={row.id}
								className={cn(
									'relative transition-colors duration-100',
									isSelected
										? 'bg-selected shadow-[inset_3px_0_0_var(--action)]'
										: 'hover:bg-surface-hover has-[a:focus-visible]:bg-surface-hover'
								)}
							>
								<td className={td}>
									<Link
										href={{ pathname: `${base}/pairs/${row.id}`, query: toQuery(listQuery) }}
										aria-label={t('openPair', {
											a: row.recordA.reference,
											b: row.recordB.reference
										})}
										className="after:absolute after:inset-0"
									>
										<CategoryBadge category={row.category} />
									</Link>
								</td>
								{[row.recordA, row.recordB].map((record) => (
									<td key={record.id} className={td}>
										<span className="text-text-muted block font-mono text-xs">
											{record.reference}
										</span>
										<span className="text-text block max-w-[180px] truncate">{record.label}</span>
									</td>
								))}
								<td className={cn(td, 'hidden lg:table-cell')}>
									{row.isVendorMatch ? (
										<span className="text-text inline-flex items-center gap-1.5">
											<CheckIcon size={14} variant="bold" /> {t('matched')}
										</span>
									) : (
										<span className="text-text-muted inline-flex items-center gap-1.5">
											<MinusIcon size={14} /> {t('notMatched')}
										</span>
									)}
								</td>
								<td className={td}>
									{row.status === 'succeeded' && row.score != null ? (
										<ScoreBar score={row.score} threshold={threshold} />
									) : (
										<Chip tone="outline" className="border-border-input border-dashed">
											{t(row.status === 'failed' ? 'failed' : 'pending')}
										</Chip>
									)}
								</td>
								<td className={cn(td, 'hidden md:table-cell')}>
									{row.status === 'succeeded' && row.score != null ? (
										isPairsightMatch({ score: row.score, threshold }) ? (
											<span className="text-text font-medium">{t('match')}</span>
										) : (
											<span className="text-text-muted">{t('noMatch')}</span>
										)
									) : (
										<span className="text-text-muted">{t('notAssessed')}</span>
									)}
								</td>
								<td className={cn(td, 'hidden max-w-[220px] xl:table-cell')}>
									<span className="text-text-muted block truncate" title={reason}>
										{reason}
									</span>
								</td>
								<td className={cn(td, 'hidden lg:table-cell')}>
									{row.status === 'succeeded' ? (
										<span className="text-text-muted">{t('assessed')}</span>
									) : row.status === 'failed' ? (
										<span className="flex items-center gap-1.5">
											<Chip
												tone="danger"
												className="max-w-[160px]"
												title={row.errorCode ?? undefined}
											>
												<span className="truncate">
													{t('failedBecause', { reason: tFailures(failureReason(row.errorCode)) })}
												</span>
											</Chip>
											{/* Above the row's full-size link, so it takes its own clicks. */}
											<span className="relative z-10">
												<ReadOnlyGate action="retry">
													<RetryPairButton
														runId={runId}
														pairId={row.id}
														compact={{
															label: t('retryPair', {
																a: row.recordA.reference,
																b: row.recordB.reference
															})
														}}
													/>
												</ReadOnlyGate>
											</span>
										</span>
									) : (
										<Chip tone="neutral">
											{t(row.status === 'running' ? 'running' : 'pending')}
										</Chip>
									)}
								</td>
								<td className={cn(td, 'hidden md:table-cell')}>
									{row.isLowConfidence ? (
										<span className="text-warning text-xs whitespace-nowrap">
											{t('lowConfidence')}
										</span>
									) : (
										<span className="text-text-muted">—</span>
									)}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

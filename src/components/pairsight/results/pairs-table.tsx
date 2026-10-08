import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Chip } from '@/components/ui/chip'
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from '@/components/ui/icons'
import type { ResultFilters, ResultRow } from '@/server/pairsight/results'
import { DiffText } from '../pair/field-compare-table'
import { CategoryBadge, CategoryDot, ScoreBar } from '../result-parts'
import { RowLink } from './pair-selection'
import { toQuery } from './query'

const SORT_ICON_SIZE = 12
const NEXT_SORT: Record<'none' | 'score-desc' | 'score-asc', ResultFilters['sort']> = {
	none: 'score-desc',
	'score-desc': 'score-asc',
	'score-asc': undefined
}

// The current page of pairs (docs/PairSight-UX-Plan.md §4.1), kept to what
// picks a pair out: who says what, the two records (the words that differ
// marked), and Jev's score. Each row selects its pair into the panel beside
// the list (pair-panel.tsx) without leaving the page; incomplete rows show
// their status where a score would be, never "different".
export function PairsTable({
	base,
	filters,
	rows,
	threshold
}: {
	base: string
	filters: ResultFilters
	rows: ResultRow[]
	threshold: number
}) {
	const t = useTranslations('Results')
	const tCat = useTranslations('Categories')
	const sort = filters.sort ?? 'none'
	const sortHref = {
		pathname: `${base}/results`,
		query: toQuery(filters, { sort: NEXT_SORT[sort], page: undefined, sel: undefined })
	}
	const listQuery = { ...filters, tab: 'detailed' as const }
	const selectHref = (id: string) =>
		`${base}/results?${new URLSearchParams(toQuery(listQuery, { sel: id }))}`
	const th =
		'border-border bg-surface-muted text-text-muted h-9 overflow-hidden border-b px-3 text-left text-xs font-medium text-ellipsis whitespace-nowrap first:pl-4 last:pr-4'
	const td = 'border-border border-b px-3 py-2.5 align-middle first:pl-4 last:pr-4'

	return (
		<div
			data-pairs-table
			className="border-border bg-surface overflow-hidden rounded-t-lg border border-b-0"
		>
			<table className="type-ui w-full table-fixed border-separate border-spacing-0">
				<caption className="sr-only">{t('tableCaption')}</caption>
				<colgroup>
					<col className="w-[44px] @2xl:w-[176px]" />
					<col />
					<col className="w-[64px] @2xl:w-[148px]" />
				</colgroup>
				<thead>
					<tr>
						<th scope="col" className={th}>
							<span className="sr-only @2xl:not-sr-only">{t('columnCategory')}</span>
						</th>
						<th scope="col" className={th}>
							{t('columnRecords')}
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
								className="hover:text-text hit-area inline-flex items-center gap-1 rounded-[4px]"
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
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						return (
							// Highlighted from its link (RowLink's data-selected), so the
							// highlight moves the moment a row is picked.
							<tr
								key={row.id}
								className="hover:bg-surface-hover has-[a:focus-visible]:bg-surface-hover has-[a[data-selected=true]]:bg-selected relative transition-colors duration-100 has-[a[data-selected=true]]:shadow-[inset_3px_0_0_var(--action)]"
							>
								<td className={td}>
									<RowLink
										pairId={row.id}
										href={selectHref(row.id)}
										label={t('selectPair', {
											a: row.recordA.reference,
											b: row.recordB.reference,
											category: tCat(row.category)
										})}
										fullHref={`${base}/pairs/${row.id}?${new URLSearchParams(
											toQuery(listQuery, { sel: undefined })
										)}`}
									>
										{/* Narrow, just the group's mark; its name is in the row's label. */}
										<span className="hidden @2xl:inline-flex">
											<CategoryBadge category={row.category} />
										</span>
										<span className="@2xl:hidden" title={tCat(row.category)}>
											<CategoryDot category={row.category} />
										</span>
									</RowLink>
								</td>
								<td className={td}>
									{[
										[row.recordA, row.recordB],
										[row.recordB, row.recordA]
									].map(([record, other]) =>
										record == null || other == null ? null : (
											<span key={record.id} className="flex min-w-0 items-baseline gap-2.5">
												<span className="text-text-muted w-16 shrink-0 truncate font-mono text-[0.6875rem]">
													{record.reference}
												</span>
												<span className="text-text min-w-0 truncate">
													<DiffText value={record.label} other={other.label} />
												</span>
											</span>
										)
									)}
								</td>
								<td className={td}>
									{row.status === 'succeeded' && row.score != null ? (
										<ScoreBar
											score={row.score}
											threshold={threshold}
											className="[&>span:first-child]:hidden @2xl:[&>span:first-child]:inline-block"
										/>
									) : (
										<Chip
											tone={row.status === 'failed' ? 'danger' : 'outline'}
											className={
												row.status === 'failed' ? undefined : 'border-border-input border-dashed'
											}
										>
											{t(
												row.status === 'failed'
													? 'failed'
													: row.status === 'running'
														? 'running'
														: 'pending'
											)}
										</Chip>
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

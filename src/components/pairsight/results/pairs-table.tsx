import { cn } from '@/lib/cn'
import { Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Chip } from '@/components/ui/chip'
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from '@/components/ui/icons'
import type { CategoryCounts } from '@/lib/pairsight/metrics'
import type { ResultCategory, ResultFilters, ResultRow } from '@/server/pairsight/results'
import { Glyph, type GlyphKind } from '../glyph'
import { DiffText } from '../pair/field-compare-table'
import { CategoryDot } from '../result-parts'
import { RowLink } from './pair-selection'
import { toQuery } from './query'

const SORT_ICON_SIZE = 12
const PERCENT = 100
const SCORE_DIGITS = 2
const NEXT_SORT: Record<'none' | 'score-desc' | 'score-asc', ResultFilters['sort']> = {
	none: 'score-desc',
	'score-desc': 'score-asc',
	'score-asc': undefined
}
// The tile beside each group's name: ice equals where Jev says same, vermilion
// not-equals where only the vendor does, grey for the rest.
const GROUP_GLYPH: Record<ResultCategory, GlyphKind> = {
	pairsight_only: 'same',
	vendor_only: 'different',
	both_matched: 'same',
	neither_matched: 'missing',
	incomplete: 'missing'
}

// A 0–1 score as a short ice bar, then the number; a narrow list keeps the
// number alone.
function ScoreCell({ score }: { score: number }) {
	return (
		<span className="inline-flex items-center justify-end gap-2">
			<span
				aria-hidden
				className="bg-border inline-block h-1.5 w-11 overflow-hidden rounded-full @max-md:hidden"
			>
				<span className="bg-ice block h-full" style={{ width: `${score * PERCENT}%` }} />
			</span>
			<span className="text-text font-semibold">{score.toFixed(SCORE_DIGITS)}</span>
		</span>
	)
}

// The current page of pairs (docs/PairSight-UX-Plan.md §4.1, pairsight-handoff
// Review): the two record IDs, the two records (the words that differ
// marked) and Jev's score. In the default order the pairs come in groups,
// disagreements first, each under its name, count and what it means; sorted
// by score, a dot says which group each is in. Each row selects its pair
// into the panel beside the list (pair-panel.tsx) without leaving the page;
// incomplete rows show their status where a score would be, never
// "different".
export function PairsTable({
	base,
	filters,
	rows,
	groupCounts
}: {
	base: string
	filters: ResultFilters
	rows: ResultRow[]
	// Each group's size for the vendor, beside its name; null while other
	// filters narrow the list, when the whole group isn't what's listed.
	groupCounts: CategoryCounts | null
}) {
	const t = useTranslations('Results')
	const tCat = useTranslations('Categories')
	const sort = filters.sort ?? 'none'
	const isGrouped = filters.sort == null
	const sortHref = {
		pathname: `${base}/results`,
		query: toQuery(filters, { sort: NEXT_SORT[sort], page: undefined, sel: undefined })
	}
	const listQuery = { ...filters, tab: 'detailed' as const }
	const selectHref = (id: string) =>
		`${base}/results?${new URLSearchParams(toQuery(listQuery, { sel: id }))}`
	const th =
		'text-text-muted h-11 px-4 text-left align-middle font-mono text-xs font-normal tracking-[0.06em] whitespace-nowrap uppercase'
	const td = 'border-border border-t px-4 py-3.5 align-middle'

	return (
		<table
			data-pairs-table
			className="w-full table-fixed border-separate border-spacing-0 font-mono text-sm"
		>
			<caption className="sr-only">{t('tableCaption')}</caption>
			<thead>
				<tr>
					{/* Narrow, the references column closes to nothing rather than
					    hiding: the group rows span all four, and a hidden column would
					    leave its share of the width empty. Screen readers still get it. */}
					<th scope="col" className={cn(th, 'w-0 px-0 @2xl:w-[184px] @2xl:px-4')}>
						<span className="@max-2xl:sr-only">{t('columnPair')}</span>
					</th>
					{/* Narrower still, record B closes the same way and shows under
					    record A, so each name gets the whole width. */}
					<th scope="col" className={th}>
						<span className="@max-xl:sr-only">{t('columnRecordA')}</span>
						<span aria-hidden className="hidden @max-xl:inline">
							{t('columnPair')}
						</span>
					</th>
					<th scope="col" className={cn(th, '@max-xl:w-0 @max-xl:px-0')}>
						<span className="@max-xl:sr-only">{t('columnRecordB')}</span>
					</th>
					<th
						scope="col"
						className={`${th} w-[92px] text-right @2xl:w-[128px]`}
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
				{rows.map((row, index) => {
					const isNewGroup = isGrouped && rows[index - 1]?.category !== row.category
					return (
						<Fragment key={row.id}>
							{isNewGroup && (
								<tr>
									<th
										scope="colgroup"
										colSpan={4}
										className="border-border bg-surface-muted border-t px-4 py-3 text-left font-sans text-base font-normal"
									>
										<span className="text-text font-semibold">
											<Glyph kind={GROUP_GLYPH[row.category]} className="mr-2.5 align-middle" />
											{groupCounts == null
												? tCat(row.category)
												: t.rich('groupTitle', {
														category: tCat(row.category),
														count: groupCounts[row.category],
														n: (chunks) => <span className="font-mono">{chunks}</span>
													})}
										</span>{' '}
										<span className="text-text-muted text-sm">
											{t(`groupHint.${row.category}`)}
										</span>
									</th>
								</tr>
							)}
							{/* Highlighted from its link (RowLink's data-selected), so the
							    highlight moves the moment a row is picked. */}
							<tr className="hover:bg-surface-muted has-[a:focus-visible]:bg-surface-muted has-[a[data-selected=true]]:bg-surface-muted relative transition-colors duration-100 has-[a[data-selected=true]]:shadow-[inset_3px_0_0_var(--action)]">
								{/* Narrow, the record IDs give way to the two names. */}
								<td className={cn(td, 'text-text-muted truncate px-0 @2xl:px-4')}>
									<span className="@max-2xl:sr-only">
										{row.recordA.reference} · {row.recordB.reference}
									</span>
								</td>
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
										<span className="text-text flex min-w-0 items-center gap-2">
											{/* Sorted by score, the groups are mixed: each row says its own. */}
											{!isGrouped && <CategoryDot category={row.category} />}
											<span className="min-w-0 flex-1">
												<span className="block truncate">
													<DiffText value={row.recordA.label} other={row.recordB.label} />
												</span>
												{/* Record B, under A on a narrow list; its own cell reads it out. */}
												<span aria-hidden className="text-text-body hidden truncate @max-xl:block">
													<DiffText value={row.recordB.label} other={row.recordA.label} />
												</span>
											</span>
										</span>
									</RowLink>
								</td>
								<td className={cn(td, '@max-xl:px-0')}>
									<span className="text-text block truncate @max-xl:sr-only">
										<DiffText value={row.recordB.label} other={row.recordA.label} />
									</span>
								</td>
								<td className={`${td} text-right`}>
									{row.status === 'succeeded' && row.score != null ? (
										<ScoreCell score={row.score} />
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
						</Fragment>
					)
				})}
			</tbody>
		</table>
	)
}

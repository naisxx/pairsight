import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { ResultFilters } from '@/server/pairsight/results'
import { PageSizeSelect } from './page-size-select'
import { toQuery } from './query'
import { exactTitle } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'

// The list card's footer: which rows are showing, rows per page, and
// Previous and Next.
export function Pagination({
	base,
	filters,
	page,
	pageCount,
	pageSize,
	total
}: {
	base: string
	filters: ResultFilters
	page: number
	pageCount: number
	pageSize: number
	total: number
}) {
	const t = useTranslations('Results')
	if (total === 0) return null
	const first = (page - 1) * pageSize + 1
	const last = Math.min(total, page * pageSize)
	const pageLink = (target: number, isDisabled: boolean, label: string, text: string) => (
		<Button asChild variant="secondary">
			<Link
				href={{
					pathname: `${base}/results`,
					query: toQuery(filters, { page: target, sel: undefined })
				}}
				aria-label={label}
				aria-disabled={isDisabled}
				className={cn(isDisabled && 'pointer-events-none opacity-50')}
			>
				{text}
			</Link>
		</Button>
	)
	return (
		<nav
			aria-label={t('pagination')}
			className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
		>
			<p
				className="text-text-muted text-sm"
				title={exactTitle([first, last, total], () =>
					t.markup('showingRows', { first, last, total, n: (chunks) => chunks }, EXACT_FORMATS)
				)}
			>
				{t.rich('showingRows', {
					first,
					last,
					total,
					n: (chunks) => <span className="font-mono">{chunks}</span>
				})}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<PageSizeSelect pageSize={pageSize} />
				{pageCount > 1 && (
					<span className="text-text-muted px-1 font-mono text-sm">
						{page}/{pageCount}
					</span>
				)}
				{pageLink(Math.max(1, page - 1), page <= 1, t('previousPage'), t('previous'))}
				{pageLink(Math.min(pageCount, page + 1), page >= pageCount, t('nextPage'), t('next'))}
			</div>
		</nav>
	)
}

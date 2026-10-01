import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { ResultFilters } from '@/server/pairsight/results'
import { PageSizeSelect } from './page-size-select'
import { toQuery } from './query'

// The table's footer: which rows are showing, rows per page, and paging.
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
	const pageLink = (target: number, isDisabled: boolean, label: string, icon: React.ReactNode) => (
		<Button asChild variant="secondary" size="icon">
			<Link
				href={{ pathname: `${base}/results`, query: toQuery(filters, { page: target }) }}
				aria-label={label}
				aria-disabled={isDisabled}
				className={cn(isDisabled && 'pointer-events-none opacity-50')}
			>
				{icon}
			</Link>
		</Button>
	)
	return (
		<nav
			aria-label={t('pagination')}
			className="border-border bg-surface type-ui flex flex-wrap items-center justify-between gap-3 rounded-b-md border px-3 py-2"
		>
			<p className="text-text-muted">
				{t.rich('showingRows', {
					first,
					last,
					total,
					n: (chunks) => <span className="text-text font-mono">{chunks}</span>
				})}
			</p>
			<div className="flex items-center gap-2">
				<PageSizeSelect pageSize={pageSize} />
				{pageLink(
					Math.max(1, page - 1),
					page <= 1,
					t('previousPage'),
					<ChevronLeftIcon size={14} />
				)}
				<span className="text-text-muted font-mono">
					{page}/{pageCount}
				</span>
				{pageLink(
					Math.min(pageCount, page + 1),
					page >= pageCount,
					t('nextPage'),
					<ChevronRightIcon size={14} />
				)}
			</div>
		</nav>
	)
}

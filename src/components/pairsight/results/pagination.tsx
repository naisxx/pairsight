import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { ResultFilters } from '@/server/pairsight/results'
import { toQuery } from './query'

export function Pagination({
	base,
	filters,
	page,
	pageCount
}: {
	base: string
	filters: ResultFilters
	page: number
	pageCount: number
}) {
	const t = useTranslations('Results')
	if (pageCount < 2) return null
	const pageLink = (target: number, isDisabled: boolean, children: React.ReactNode) => (
		<Button asChild variant="outline" size="sm">
			<Link
				href={{ pathname: `${base}/results`, query: toQuery(filters, { page: target }) }}
				aria-disabled={isDisabled}
				className={cn(isDisabled && 'pointer-events-none opacity-50')}
			>
				{children}
			</Link>
		</Button>
	)
	return (
		<nav
			className="mt-4 flex items-center justify-end gap-2"
			aria-label={t('page', { page, pages: pageCount })}
		>
			<span className="text-text-muted type-body mr-2">
				{t('page', { page, pages: pageCount })}
			</span>
			{pageLink(
				Math.max(1, page - 1),
				page <= 1,
				<>
					<ChevronLeftIcon />
					{t('previous')}
				</>
			)}
			{pageLink(
				Math.min(pageCount, page + 1),
				page >= pageCount,
				<>
					{t('next')}
					<ChevronRightIcon />
				</>
			)}
		</nav>
	)
}

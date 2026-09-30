import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import type { CategoryCounts, ResultCategory, ResultFilters } from '@/server/pairsight/results'
import { CategoryDot, CATEGORY_STYLES } from '../result-parts'
import { toQuery } from './query'

const TILE_ORDER: ResultCategory[] = [
	'pairsight_only',
	'vendor_only',
	'both_matched',
	'neither_matched',
	'incomplete'
]
// Disagreements are visually stronger (where a reviewer's attention goes)
// without implying which side is right.
const DISAGREEMENTS = new Set<ResultCategory>(['pairsight_only', 'vendor_only'])

// The four agreement categories plus Incomplete; each tile is also a filter.
export function CategoryTiles({
	base,
	filters,
	counts,
	evaluated
}: {
	base: string
	filters: ResultFilters
	counts: CategoryCounts
	evaluated: number
}) {
	const tCat = useTranslations('Categories')
	const format = useFormatter()
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
			{TILE_ORDER.map((category) => {
				const isSelected = filters.category === category
				const count = counts[category]
				const share =
					category === 'incomplete' || evaluated === 0
						? null
						: Math.round((count / evaluated) * 100)
				return (
					<Link
						key={category}
						href={{
							pathname: `${base}/results`,
							query: toQuery(filters, {
								category: isSelected ? undefined : category,
								page: undefined
							})
						}}
						aria-pressed={isSelected}
						className={cn(
							'bg-surface hover:bg-surface-hover focus-visible:outline-ring flex flex-col gap-1 rounded-lg border p-4 transition-colors focus-visible:outline-2',
							CATEGORY_STYLES[category].tile,
							isSelected && 'ring-action ring-2',
							!DISAGREEMENTS.has(category) && category !== 'incomplete' && 'opacity-90'
						)}
					>
						<span className="text-text type-subheading flex items-center gap-2">
							<CategoryDot category={category} />
							{tCat(category)}
						</span>
						<span className="flex items-baseline gap-2">
							<span
								className={cn(
									'text-text type-metric',
									!DISAGREEMENTS.has(category) && 'text-2xl leading-8'
								)}
							>
								{format.number(count)}
							</span>
							{share != null && <span className="text-text-muted type-label">{share}%</span>}
						</span>
						<span className="text-text-muted type-meta">{tCat(`${category}Meaning`)}</span>
					</Link>
				)
			})}
		</div>
	)
}

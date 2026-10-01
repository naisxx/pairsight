import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { AnimatedCount } from '@/components/ui/animated-number'
import { ArrowRightIcon } from '@/components/ui/icons'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import type { Category } from '@/lib/pairsight/decisions'
import { cn } from '@/lib/cn'
import { CategoryDot, CATEGORY_STYLES } from '../../result-parts'

const ORDER: Category[] = ['both_matched', 'pairsight_only', 'vendor_only', 'neither_matched']
const PERCENT = 100

// Disagreements get a faint tint of their category: where attention goes,
// without implying which side is right.
const DISAGREEMENT_TINT: Partial<Record<Category, string>> = {
	pairsight_only: 'bg-cat-pairsight-subtle',
	vendor_only: 'bg-cat-vendor-subtle'
}
const DISAGREEMENT_TEXT: Partial<Record<Category, string>> = {
	pairsight_only: 'text-cat-pairsight',
	vendor_only: 'text-cat-vendor'
}

// The four agreement categories plus Incomplete. Each opens its pairs in
// the detailed view.
export function CategorySummary({
	vendorName,
	metrics,
	pairsHref
}: {
	vendorName: string
	metrics: VendorMetrics
	pairsHref: (category: Category | 'incomplete') => {
		pathname: string
		query: Record<string, string>
	}
}) {
	const t = useTranslations('Overview')
	const tCat = useTranslations('Categories')
	const viewPairs = (
		<span className="text-accent-ink mt-auto flex items-center gap-1 pt-3 text-xs font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
			{t('viewPairs')} <ArrowRightIcon size={12} />
		</span>
	)

	return (
		<section aria-label={t('categoriesLabel')}>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
				{ORDER.map((category) => {
					const count = metrics.counts[category]
					const share = metrics.assessed === 0 ? 0 : (count / metrics.assessed) * PERCENT
					const tint = DISAGREEMENT_TINT[category]
					return (
						<Link
							key={category}
							href={pairsHref(category)}
							aria-label={t('categoryTileLabel', { category: tCat(category), count })}
							className={cn(
								'group border-border hover:border-border-input flex h-full flex-col rounded-md border p-3.5 text-left transition-[background-color,border-color] duration-150 ease-out',
								tint ?? 'bg-surface hover:bg-surface-hover'
							)}
						>
							<span className="text-text type-ui flex items-center gap-2 font-medium">
								<CategoryDot category={category} />
								{tCat(category)}
							</span>
							<span className="mt-2 flex items-baseline gap-2">
								<AnimatedCount
									value={count}
									className={cn(
										'font-mono text-[26px] leading-none font-medium',
										DISAGREEMENT_TEXT[category] ?? 'text-text'
									)}
								/>
								<span className="text-text-muted font-mono text-xs">{share.toFixed(0)}%</span>
							</span>
							<span aria-hidden className="bg-surface-muted mt-2 h-1 overflow-hidden rounded-full">
								<span
									className={cn(
										'block h-full rounded-full transition-[width] duration-300 ease-out',
										CATEGORY_STYLES[category].fill
									)}
									style={{ width: `${share}%` }}
								/>
							</span>
							<span className="text-text-muted mt-2 text-xs leading-snug">
								{t(`meaning.${category}`, { vendor: vendorName })}
							</span>
							{viewPairs}
						</Link>
					)
				})}
				<Link
					href={pairsHref('incomplete')}
					aria-label={t('categoryTileLabel', {
						category: tCat('incomplete'),
						count: metrics.counts.incomplete
					})}
					className="group border-border-input hover:bg-surface-hover flex h-full flex-col rounded-md border border-dashed bg-transparent p-3.5 text-left transition-[background-color] duration-150 ease-out"
				>
					<span className="text-text-muted type-ui flex items-center gap-2 font-medium">
						<CategoryDot category="incomplete" />
						{tCat('incomplete')}
					</span>
					<span className="text-text-muted mt-2 font-mono text-[26px] leading-none font-medium">
						{metrics.counts.incomplete}
					</span>
					<span className="text-text-muted mt-2 text-xs leading-snug">
						{t.rich('incompleteMeaning', {
							pending: metrics.pending,
							failed: metrics.failed,
							n: (chunks) => <span className="font-mono">{chunks}</span>
						})}
					</span>
					{viewPairs}
				</Link>
			</div>
		</section>
	)
}

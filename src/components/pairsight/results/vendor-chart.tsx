import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { CategoryCounts, ResultCategory } from '@/server/pairsight/results'
import { CategoryDot, CATEGORY_STYLES } from '../result-parts'

const ORDER: ResultCategory[] = [
	'both_matched',
	'pairsight_only',
	'vendor_only',
	'neither_matched',
	'incomplete'
]

// Each vendor's agreement profile as one stacked bar, so vendors compare at a
// glance (docs/PairSight-UX-Plan.md §8). Only rendered with two or more
// vendors; one vendor's tiles already say all of this. Counts are labelled
// directly, and screen readers get the same numbers as a table.
export function VendorChart({
	vendors
}: {
	vendors: Array<{ id: string; name: string; counts: CategoryCounts }>
}) {
	const t = useTranslations('Results')
	const tCat = useTranslations('Categories')
	return (
		<section className="border-border bg-surface mt-4 rounded-lg border p-5">
			<h2 className="text-text type-subheading">{t('vendorChartTitle')}</h2>
			<div aria-hidden className="mt-3 flex flex-col gap-3">
				{vendors.map((vendor) => {
					const total = ORDER.reduce((sum, category) => sum + vendor.counts[category], 0)
					return (
						<div key={vendor.id} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
							<span className="text-text type-label truncate">{vendor.name}</span>
							<div className="flex h-5 overflow-hidden rounded">
								{ORDER.map((category) =>
									vendor.counts[category] === 0 ? null : (
										<span
											key={category}
											className={cn(
												'text-bg type-data-sm flex items-center justify-center',
												CATEGORY_STYLES[category].fill
											)}
											style={{ width: `${(vendor.counts[category] / Math.max(1, total)) * 100}%` }}
										>
											{category === 'incomplete' ? (
												<span className="text-text-muted">{vendor.counts[category]}</span>
											) : (
												vendor.counts[category]
											)}
										</span>
									)
								)}
							</div>
						</div>
					)
				})}
			</div>
			<ul aria-hidden className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
				{ORDER.map((category) => (
					<li key={category} className="text-text-muted type-meta flex items-center gap-1.5">
						<CategoryDot category={category} />
						{tCat(category)}
					</li>
				))}
			</ul>
			<table className="sr-only">
				<caption>{t('vendorChartTitle')}</caption>
				<thead>
					<tr>
						<th scope="col">{t('columnVendor')}</th>
						{ORDER.map((category) => (
							<th key={category} scope="col">
								{tCat(category)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{vendors.map((vendor) => (
						<tr key={vendor.id}>
							<th scope="row">{vendor.name}</th>
							{ORDER.map((category) => (
								<td key={category}>{vendor.counts[category]}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	)
}

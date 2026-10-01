'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { AnimatedCount } from '@/components/ui/animated-number'
import { Panel } from '@/components/ui/panel'
import { ViewToggle, type ChartView } from '@/components/ui/view-toggle'
import type { Category } from '@/lib/pairsight/decisions'
import type { CategoryCounts } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'
import { CategoryDot } from '../../result-parts'

const TINT: Partial<Record<Category, { cell: string; text: string }>> = {
	pairsight_only: { cell: 'bg-cat-pairsight-subtle', text: 'text-cat-pairsight' },
	vendor_only: { cell: 'bg-cat-vendor-subtle', text: 'text-cat-vendor' }
}

function MatrixCell({
	category,
	count,
	href
}: {
	category: Category
	count: number
	href: string
}) {
	const t = useTranslations('Overview')
	const tCat = useTranslations('Categories')
	const tint = TINT[category]
	return (
		<Link
			href={href}
			aria-label={t('categoryTileLabel', { category: tCat(category), count })}
			className={cn(
				'border-border hover:border-border-input flex min-h-[92px] flex-col justify-between rounded-sm border p-3 text-left transition-[background-color,border-color] duration-150 ease-out',
				tint?.cell ?? 'bg-surface hover:bg-surface-hover'
			)}
		>
			<AnimatedCount
				value={count}
				className={cn('font-mono text-[28px] leading-none font-medium', tint?.text ?? 'text-text')}
			/>
			<span className="text-text flex items-center gap-1.5 text-xs font-medium">
				<CategoryDot category={category} className="size-2" />
				{tCat(category)}
			</span>
		</Link>
	)
}

// The vendor's decisions against PairSight's, as a 2×2: each cell is a
// category and opens its pairs. The same numbers as a table, with totals.
export function DecisionMatrix({
	vendorName,
	counts,
	assessed,
	categoryHrefs,
	className
}: {
	vendorName: string
	counts: CategoryCounts
	assessed: number
	categoryHrefs: Record<Category, string>
	className?: string
}) {
	const t = useTranslations('Overview')
	const [view, setView] = useState<ChartView>('chart')

	const axis = 'text-text-muted text-xs font-medium'
	return (
		<Panel
			id="matrix"
			title={t('matrixTitle')}
			description={t('matrixDescription', { vendor: vendorName, assessed })}
			className={className}
			actions={
				<ViewToggle
					view={view}
					onChange={setView}
					labels={{ showTable: t('showTable'), showChart: t('showChart') }}
				/>
			}
		>
			{view === 'chart' ? (
				<div className="grid grid-cols-[88px_1fr_1fr] gap-2">
					<span />
					<span className={cn(axis, 'pb-1 text-center')}>{t('pairsightMatched')}</span>
					<span className={cn(axis, 'pb-1 text-center')}>{t('pairsightNotMatched')}</span>
					<span className={cn(axis, 'flex items-center leading-tight')}>
						{t('vendorMatched', { vendor: vendorName })}
					</span>
					<MatrixCell
						category="both_matched"
						count={counts.both_matched}
						href={categoryHrefs.both_matched}
					/>
					<MatrixCell
						category="vendor_only"
						count={counts.vendor_only}
						href={categoryHrefs.vendor_only}
					/>
					<span className={cn(axis, 'flex items-center leading-tight')}>
						{t('vendorNotMatched', { vendor: vendorName })}
					</span>
					<MatrixCell
						category="pairsight_only"
						count={counts.pairsight_only}
						href={categoryHrefs.pairsight_only}
					/>
					<MatrixCell
						category="neither_matched"
						count={counts.neither_matched}
						href={categoryHrefs.neither_matched}
					/>
				</div>
			) : (
				<table className="type-ui w-full">
					<caption className="sr-only">{t('matrixCaption', { vendor: vendorName })}</caption>
					<thead>
						<tr className="border-border text-text-muted border-b text-left text-xs">
							<th scope="col" className="py-2 font-medium">
								{vendorName}
							</th>
							<th scope="col" className="py-2 text-right font-medium">
								{t('pairsightMatched')}
							</th>
							<th scope="col" className="py-2 text-right font-medium">
								{t('pairsightNotMatched')}
							</th>
							<th scope="col" className="py-2 text-right font-medium">
								{t('total')}
							</th>
						</tr>
					</thead>
					<tbody className="font-mono">
						<tr className="border-border border-b">
							<th scope="row" className="py-2 text-left font-sans font-normal">
								{t('matched')}
							</th>
							<td className="py-2 text-right">{counts.both_matched}</td>
							<td className="py-2 text-right">{counts.vendor_only}</td>
							<td className="py-2 text-right">{counts.both_matched + counts.vendor_only}</td>
						</tr>
						<tr className="border-border border-b">
							<th scope="row" className="py-2 text-left font-sans font-normal">
								{t('notMatched')}
							</th>
							<td className="py-2 text-right">{counts.pairsight_only}</td>
							<td className="py-2 text-right">{counts.neither_matched}</td>
							<td className="py-2 text-right">{counts.pairsight_only + counts.neither_matched}</td>
						</tr>
						<tr>
							<th scope="row" className="text-text-muted py-2 text-left font-sans font-normal">
								{t('total')}
							</th>
							<td className="py-2 text-right">{counts.both_matched + counts.pairsight_only}</td>
							<td className="py-2 text-right">{counts.vendor_only + counts.neither_matched}</td>
							<td className="py-2 text-right">{assessed}</td>
						</tr>
					</tbody>
				</table>
			)}
			<p className="text-text-muted mt-3 text-xs">{t('agreementNotCorrectness')}</p>
		</Panel>
	)
}

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { InsightIcon } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import { Panel } from '@/components/ui/panel'
import type { Category } from '@/lib/pairsight/decisions'
import { cn } from '@/lib/cn'
import type { FieldPatterns } from '@/server/pairsight/result-overview'
import { CategoryDot } from '../../result-parts'

const PERCENT = 100
// The strongest tint a cell gets (at 100% agreement), mixed from its category.
const MAX_TINT_PERCENT = 34
const CATEGORY_FILL: Record<Category, string> = {
	both_matched: 'var(--cat-both)',
	pairsight_only: 'var(--cat-pairsight)',
	vendor_only: 'var(--cat-vendor)',
	neither_matched: 'var(--cat-neither)'
}

// For each category, how often each field agrees between the two records:
// what PairSight-only pairs have in common is what the vendor's matching
// misses, and what vendor-only pairs share is what it over-trusts.
export function FieldPatternsPanel({
	vendorName,
	patterns,
	categoryHrefs,
	className
}: {
	vendorName: string
	patterns: FieldPatterns
	categoryHrefs: Record<Category, string>
	className?: string
}) {
	const t = useTranslations('Overview')
	const tCat = useTranslations('Categories')
	const tRoles = useTranslations('Roles')
	const list = (roles: string[]) => roles.map((role) => tRoles(role)).join(t('and'))

	const readings: string[] = []
	const missed = patterns.summary.pairsight_only
	if (missed != null) {
		readings.push(
			missed.different.length > 0
				? t('patternMissedDiffer', {
						shared: list(missed.shared),
						different: list(missed.different),
						vendor: vendorName
					})
				: t('patternMissed', { shared: list(missed.shared), vendor: vendorName })
		)
	}
	const merged = patterns.summary.vendor_only
	if (merged != null) {
		readings.push(
			merged.different.length > 0
				? t('patternMergedDiffer', {
						shared: list(merged.shared),
						different: list(merged.different),
						vendor: vendorName
					})
				: t('patternMerged', { shared: list(merged.shared), vendor: vendorName })
		)
	}

	return (
		<Panel
			id="patterns"
			title={
				<span className="inline-flex items-center gap-1">
					{t('patternsTitle')}
					<InfoTip label={t('patternsInfoLabel')} content={t('patternsInfo')} />
				</span>
			}
			description={t('patternsDescription')}
			className={className}
			bodyClassName="p-0 pt-2"
		>
			<div className="scroll-fade-x relative overflow-x-auto">
				<table className="type-ui w-full min-w-[520px] border-separate border-spacing-0">
					<caption className="sr-only">{t('patternsCaption')}</caption>
					<thead>
						<tr>
							<th
								scope="col"
								className="border-border text-text-muted border-b px-4 py-2 text-left text-xs font-medium"
							>
								{t('fieldLabel')}
							</th>
							{patterns.columns.map((column) => (
								<th
									key={column.category}
									scope="col"
									className="border-border border-b px-2 py-2 text-left text-xs font-medium"
								>
									<Link
										href={categoryHrefs[column.category]}
										className="text-text hover:text-accent-ink inline-flex items-center gap-1.5 rounded-[4px]"
									>
										<CategoryDot category={column.category} className="size-2" />
										{tCat(column.category)}
										<span className="text-text-muted font-mono">{column.count}</span>
									</Link>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{patterns.rows.map((row) => (
							<tr key={row.role}>
								<th
									scope="row"
									className="border-border text-text-muted border-b px-4 py-1.5 text-left font-normal"
								>
									{tRoles(row.role)}
								</th>
								{patterns.columns.map((column) => {
									const cell = row.cells[column.category]
									const isEmpty = cell == null || cell.total === 0
									return (
										<td key={column.category} className="border-border border-b px-1 py-1">
											<span
												title={
													isEmpty
														? t('patternNoValues')
														: t('patternCellTitle', { same: cell.same, total: cell.total })
												}
												className={cn(
													'flex h-8 items-center justify-between gap-2 rounded-[5px] px-2 transition-[background-color] duration-300 ease-out',
													isEmpty && 'text-text-muted'
												)}
												style={
													isEmpty
														? undefined
														: {
																background: `color-mix(in srgb, ${CATEGORY_FILL[column.category]} ${Math.round(cell.share * MAX_TINT_PERCENT)}%, transparent)`
															}
												}
											>
												<span className="font-mono text-[0.78125rem]">
													{isEmpty ? '—' : `${Math.round(cell.share * PERCENT)}%`}
												</span>
												{!isEmpty && (
													<span className="text-text-muted font-mono text-[0.6875rem]">
														{cell.same}/{cell.total}
													</span>
												)}
											</span>
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{readings.length > 0 && (
				<ul className="flex flex-col gap-1.5 px-4 py-3">
					{readings.map((reading) => (
						<li key={reading} className="text-text flex items-start gap-2 text-xs leading-relaxed">
							<InsightIcon size={14} className="text-text-muted mt-0.5 shrink-0" />
							{reading}
						</li>
					))}
				</ul>
			)}
		</Panel>
	)
}

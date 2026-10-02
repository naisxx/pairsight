import { useTranslations } from 'next-intl'
import { WarningCircleIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

const CELL_ICON_SIZE = 13

// The first rows as they are in the file, each column headed by the field
// it's mapped to. Rows whose reference has a problem are marked in place.
export function RecordsPreview({
	headers,
	rows,
	fieldLabels,
	referenceColumn,
	problemRows
}: {
	headers: string[]
	rows: Array<{ rowNumber: number; cells: string[] }>
	fieldLabels: Record<string, string | null>
	referenceColumn: string | null
	problemRows: ReadonlySet<number>
}) {
	const t = useTranslations('Records')
	const referenceIndex = referenceColumn == null ? -1 : headers.indexOf(referenceColumn)
	return (
		<section aria-labelledby="preview-title" className="border-border bg-surface rounded-md border">
			<header className="flex items-center justify-between px-4 py-3">
				<h2 id="preview-title" className="text-sm font-semibold">
					{t('previewTitle')}
				</h2>
				<p className="text-text-muted text-xs">{t('previewRows', { count: rows.length })}</p>
			</header>
			{/* Focusable, so the keyboard can scroll it sideways. */}
			<div
				role="region"
				tabIndex={0}
				aria-label={t('previewCaption')}
				className="border-border scroll-fade-x relative overflow-x-auto border-t"
			>
				<table className="w-full border-separate border-spacing-0 text-[12.5px]">
					<caption className="sr-only">{t('previewCaption')}</caption>
					<thead className="bg-surface-muted">
						<tr>
							<th
								scope="col"
								className="border-border bg-surface-muted text-text-muted type-caption sticky left-0 z-[1] w-12 border-b px-3 py-2 text-left font-medium"
							>
								{t('rowColumn')}
							</th>
							{headers.map((header) => {
								const field = fieldLabels[header] ?? null
								return (
									<th
										key={header}
										scope="col"
										className="border-border border-b px-3 py-2 text-left align-bottom font-medium whitespace-nowrap"
									>
										<span
											className={cn(
												'type-caption block',
												field == null ? 'text-text-muted' : 'text-accent-ink'
											)}
										>
											{field ?? t('notMapped')}
										</span>
										<span className="text-text block font-mono text-xs">{header}</span>
									</th>
								)
							})}
						</tr>
					</thead>
					<tbody className="font-mono">
						{rows.map((row) => {
							const hasProblem = problemRows.has(row.rowNumber)
							return (
								<tr key={row.rowNumber}>
									<td className="border-border bg-surface text-text-muted sticky left-0 border-b px-3 py-2">
										{row.rowNumber}
									</td>
									{headers.map((header, index) => {
										const value = row.cells[index] ?? ''
										const isBad = hasProblem && index === referenceIndex
										return (
											<td
												key={header}
												className={cn(
													'border-border border-b px-3 py-2 whitespace-nowrap',
													isBad
														? 'bg-danger-subtle text-danger'
														: value === ''
															? 'text-text-muted'
															: 'text-text'
												)}
											>
												{isBad && (
													<WarningCircleIcon
														size={CELL_ICON_SIZE}
														className="mr-1 inline align-[-2px]"
													/>
												)}
												{isBad && <span className="sr-only">{t('problemCell')}: </span>}
												{value === '' ? (isBad ? t('missingCell') : '∅') : value}
											</td>
										)
									})}
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</section>
	)
}

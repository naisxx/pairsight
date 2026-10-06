import { useFormatter, useTranslations } from 'next-intl'
import { InfoIcon, SuccessIcon, WarningCircleIcon } from '@/components/ui/icons'
import type { ColumnCheck } from '@/server/pairsight/source-records'
import { cn } from '@/lib/cn'
import { useRowList } from '../validation'

const LISTED = 6
const ICON_SIZE = 16
const NOTE_ICON_SIZE = 15

// Problems with the chosen reference column, as they'll block saving: each
// missing or repeated reference with its rows. Fixing happens in the file;
// this only says where to look. `bare`: inside the records file card, which
// shows the all-clear as a chip, so only the problems (and the note on empty
// values) are left to say.
export function SourceValidation({
	check,
	rowCount,
	blanks,
	bare = false
}: {
	bare?: boolean
	// The chosen reference column's check; undefined while none is chosen.
	check: ColumnCheck | undefined
	rowCount: number
	blanks: Array<{ field: string; count: number }>
}) {
	const t = useTranslations('Records')
	const format = useFormatter()
	const list = useRowList()
	const mono = (chunks: React.ReactNode) => <span className="font-mono">{chunks}</span>
	const problemCount = check == null ? 0 : check.blank + check.duplicateCount
	const items =
		check == null
			? []
			: [
					...check.missing.map((row) => ({
						key: `m${row}`,
						rows: [row],
						count: 1,
						reference: null
					})),
					...check.duplicates.map((duplicate) => ({
						key: `d${duplicate.reference}`,
						rows: duplicate.rows,
						count: duplicate.count,
						reference: duplicate.reference
					}))
				].sort((a, b) => (a.rows[0] ?? 0) - (b.rows[0] ?? 0))

	const isClear = check != null && problemCount === 0
	if (bare && isClear && blanks.length === 0) return null
	return (
		<section
			aria-labelledby="validation-title"
			className={cn(bare ? 'border-border border-t' : 'border-border bg-surface rounded-md border')}
		>
			<header className={cn('px-4 py-3', bare && isClear && 'sr-only')}>
				<h2 id="validation-title" className="text-sm font-semibold">
					{t('validationTitle')}
				</h2>
			</header>
			<div className={cn('space-y-3 px-4 pb-4', bare && isClear && 'pt-3')}>
				{bare && isClear ? null : check == null ? (
					<div className="bg-danger-subtle text-danger type-ui flex gap-2 rounded-sm p-3">
						<WarningCircleIcon size={ICON_SIZE} className="mt-0.5 shrink-0" />
						<p>{t('noReference')}</p>
					</div>
				) : problemCount === 0 ? (
					<div className="bg-success-subtle text-success type-ui flex gap-2 rounded-sm p-3">
						<SuccessIcon size={ICON_SIZE} variant="solid" className="mt-0.5 shrink-0" />
						<p>{t.rich('allGood', { count: rowCount, n: mono })}</p>
					</div>
				) : (
					<div>
						<div
							role="alert"
							className="bg-danger-subtle text-danger type-ui flex gap-2 rounded-sm p-3"
						>
							<WarningCircleIcon size={ICON_SIZE} className="mt-0.5 shrink-0" />
							<p>{t.rich('problems', { count: problemCount, n: mono })}</p>
						</div>
						<ul className="divide-border border-border mt-2 divide-y rounded-sm border">
							{items.slice(0, LISTED).map((item) => (
								<li key={item.key} className="type-ui px-3 py-2.5">
									<span className="text-text-muted font-mono">
										{item.count === 1
											? t('rowLabel', { row: item.rows[0] ?? 0 })
											: t('rowsLabel', { rows: list(item.rows, item.count) })}
									</span>
									<span className="text-text-muted mx-1.5">·</span>
									<span className="font-medium">
										{item.reference == null ? t('missingRef') : t('duplicateRef')}
									</span>
									{item.reference != null && (
										<span className="ml-1 font-mono">{item.reference}</span>
									)}
								</li>
							))}
						</ul>
						{problemCount > LISTED && (
							<p className="text-text-muted mt-2 text-xs">
								{t('moreProblems', { count: problemCount - LISTED })}
							</p>
						)}
					</div>
				)}

				{blanks.length > 0 && (
					<div className="text-text-muted flex gap-2 text-xs">
						<InfoIcon size={NOTE_ICON_SIZE} className="mt-0.5 shrink-0" />
						<p>
							{t('blanksNote', {
								fields: blanks
									.map((blank) => `${blank.field}: ${format.number(blank.count, 'compact')}`)
									.join(', ')
							})}
						</p>
					</div>
				)}
			</div>
		</section>
	)
}

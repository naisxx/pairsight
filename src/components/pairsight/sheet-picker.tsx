'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRightIcon, SpinnerIcon, TableIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { TableError } from '@/server/pairsight/tabular'
import { ScrollArea } from '@/components/ui/scroll-area'

export type SheetChoice = Extract<TableError, { code: 'choose_sheet' }>['sheets'][number]

const ICON_SIZE = 18
const ROW_ICON_SIZE = 14

// A workbook with more than one sheet of data: one choice per sheet, with its
// row count. Choosing one reads the file again, from that sheet.
export function SheetPicker({
	fileName,
	sheets,
	picked,
	isBusy,
	onPick
}: {
	fileName: string
	sheets: SheetChoice[]
	picked: string | null
	isBusy: boolean
	onPick: (sheet: string) => void
}) {
	const t = useTranslations('SheetPicker')
	const titleId = useId()
	const file = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	return (
		<section
			aria-labelledby={titleId}
			className="border-border bg-surface animate-float-in rounded-md border p-4"
		>
			<p id={titleId} className="flex items-center gap-2 text-sm font-semibold">
				<TableIcon size={ICON_SIZE} className="text-text-muted shrink-0" />
				{t('title')}
			</p>
			<p className="text-text-muted type-ui mt-1">
				{t.rich('description', { fileName, count: sheets.length, file })}
			</p>
			<ScrollArea label={t('title')} className="mt-3 max-h-80">
				<ul className="space-y-2">
					{sheets.map((sheet) => (
						<li key={sheet.name}>
							<button
								type="button"
								onClick={() => onPick(sheet.name)}
								disabled={isBusy}
								className={cn(
									'border-border-input hover:bg-surface-hover type-ui flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-[background-color,border-color] duration-150 disabled:cursor-default',
									picked === sheet.name && 'border-action bg-surface-hover'
								)}
							>
								<span className="min-w-0 flex-1 truncate font-mono font-medium">{sheet.name}</span>
								<span className="text-text-muted text-xs">{t('rows', { count: sheet.rows })}</span>
								{isBusy && picked === sheet.name ? (
									<SpinnerIcon size={ROW_ICON_SIZE} className="text-text-muted" />
								) : (
									<ChevronRightIcon size={ROW_ICON_SIZE} className="text-text-muted" />
								)}
							</button>
						</li>
					))}
				</ul>
			</ScrollArea>
		</section>
	)
}

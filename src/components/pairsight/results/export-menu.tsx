'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon, CsvFileIcon, DownloadIcon, XlsxFileIcon } from '@/components/ui/icons'
import type { TabularFormat } from '@/lib/pairsight/tabular-formats'

const ICON_SIZE = 15
const FORMATS: Array<{ format: TabularFormat; Icon: typeof CsvFileIcon }> = [
	{ format: 'csv', Icon: CsvFileIcon },
	{ format: 'xlsx', Icon: XlsxFileIcon }
]

// Export a run's findings (every pair, every vendor) in a format of the
// user's choice. Each item is a plain download link, not client navigation:
// the route sends a file.
export function ExportMenu({ runId, runNumber }: { runId: string; runNumber: number }) {
	const t = useTranslations('Results')
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="secondary" size="sm" aria-label={t('exportLabel', { number: runNumber })}>
					<DownloadIcon size={ICON_SIZE} />
					{t('export')}
					<ChevronDownIcon size={ICON_SIZE} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-44">
				{FORMATS.map(({ format, Icon }) => (
					<DropdownMenuItem key={format} asChild>
						<a href={`/api/runs/${runId}/findings?format=${format}`} download>
							<Icon size={ICON_SIZE} className="text-text-muted" />
							{t(`export_${format}`)}
						</a>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

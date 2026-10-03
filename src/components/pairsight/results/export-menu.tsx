'use client'

import { Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
	ChevronDownIcon,
	CsvFileIcon,
	DownloadIcon,
	PdfFileIcon,
	XlsxFileIcon
} from '@/components/ui/icons'

const ICON_SIZE = 15
// The findings (every pair, every vendor) as a table, then the summary report.
const DOWNLOADS = [
	[
		{ key: 'export_csv', path: 'findings?format=csv', Icon: CsvFileIcon },
		{ key: 'export_xlsx', path: 'findings?format=xlsx', Icon: XlsxFileIcon }
	],
	[{ key: 'export_pdf', path: 'summary', Icon: PdfFileIcon }]
] as const

// A run's downloads. Each item is a plain download link, not client
// navigation: the route sends a file.
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
			<DropdownMenuContent align="end" className="min-w-52">
				{DOWNLOADS.map((group, index) => (
					<Fragment key={group[0].key}>
						{index > 0 && <DropdownMenuSeparator />}
						{group.map(({ key, path, Icon }) => (
							<DropdownMenuItem key={key} asChild>
								<a href={`/api/runs/${runId}/${path}`} download>
									<Icon size={ICON_SIZE} className="text-text-muted" />
									{t(key)}
								</a>
							</DropdownMenuItem>
						))}
					</Fragment>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

'use client'

import { Fragment, useState } from 'react'
import { useTranslations } from 'next-intl'
import { captureClientError } from '@/lib/observability/capture-client-error'
import { dismissToast, toast } from '@/lib/toast'
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
	SpinnerIcon,
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
type DownloadKey = (typeof DOWNLOADS)[number][number]['key']
// Long enough for the browser to take the file before its URL is released.
const RELEASE_URL_AFTER_MS = 1000

// The file name the route sends (Content-Disposition), preferring the UTF-8 one.
function fileNameOf(disposition: string | null): string | null {
	if (disposition == null) return null
	const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
	if (encoded != null) return decodeURIComponent(encoded)
	return /filename="([^"]+)"/i.exec(disposition)?.[1] ?? null
}

// The route's file, or why it couldn't be had. Never throws.
async function fetchFile(
	url: string,
	fallbackName: string
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; error: unknown }> {
	try {
		const response = await fetch(url)
		if (!response.ok)
			return { ok: false, error: new Error(`Export failed with HTTP ${response.status}`) }
		const fileName = fileNameOf(response.headers.get('content-disposition')) ?? fallbackName
		return { ok: true, blob: await response.blob(), fileName }
	} catch (error) {
		return { ok: false, error }
	}
}

function saveFile(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.append(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), RELEASE_URL_AFTER_MS)
}

// A run's downloads. A file can take a few seconds to build (the PDF most),
// so the menu fetches it itself: the button spins and a toast says it's being
// prepared until the download starts, or says why it couldn't.
export function ExportMenu({ runId, runNumber }: { runId: string; runNumber: number }) {
	const t = useTranslations('Results')
	const [preparing, setPreparing] = useState<DownloadKey | null>(null)

	async function download(key: DownloadKey, path: string) {
		setPreparing(key)
		const toastId = toast({
			title: t('exportPreparing', { format: key }),
			description: t('exportPreparingHint'),
			isLoading: true
		})
		const result = await fetchFile(`/api/runs/${runId}/${path}`, `pairsight-run-${runNumber}`)
		dismissToast(toastId)
		setPreparing(null)
		if (result.ok) {
			saveFile(result.blob, result.fileName)
			toast({ title: t('exportReady'), description: result.fileName })
			return
		}
		captureClientError(result.error, { runId, export: key })
		toast({ title: t('exportFailed'), description: t('exportFailedHint'), variant: 'destructive' })
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="secondary"
					size="sm"
					aria-label={t('exportLabel', { number: runNumber })}
					aria-busy={preparing != null}
					disabled={preparing != null}
				>
					{preparing == null ? <DownloadIcon size={ICON_SIZE} /> : <SpinnerIcon size={ICON_SIZE} />}
					{preparing == null ? t('export') : t('exporting')}
					<ChevronDownIcon size={ICON_SIZE} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-52">
				{DOWNLOADS.map((group, index) => (
					<Fragment key={group[0].key}>
						{index > 0 && <DropdownMenuSeparator />}
						{group.map(({ key, path, Icon }) => (
							<DropdownMenuItem key={key} onSelect={() => void download(key, path)}>
								<Icon size={ICON_SIZE} className="text-text-muted" />
								{t(key)}
							</DropdownMenuItem>
						))}
					</Fragment>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

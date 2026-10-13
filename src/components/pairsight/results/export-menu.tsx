'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { XLSX_MAX_ROWS } from '@/lib/pairsight/tabular-formats'
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
	CsvFileIcon,
	DownloadIcon,
	PdfFileIcon,
	SpinnerIcon,
	XlsxFileIcon
} from '@/components/ui/icons'

const ICON_SIZE = 15
const TRIGGER_ICON_SIZE = 18
// The findings (every pair, every vendor) as a table: linked directly, so a
// file of any size streams to disk with the browser's own progress.
const FINDINGS = [
	{ key: 'export_csv', format: 'csv', Icon: CsvFileIcon },
	{ key: 'export_xlsx', format: 'xlsx', Icon: XlsxFileIcon }
] as const
// The summary report takes a few seconds to build, so the menu fetches it
// itself and says so.
const REPORT = { key: 'export_pdf', path: 'summary' } as const
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

// A run's downloads, the dock's main action on Results. The findings files
// are plain links; the summary report is fetched by the menu: the button spins and a toast says it's being
// prepared until the download starts, or says why it couldn't.
export function ExportMenu({
	runId,
	runNumber,
	pairCount
}: {
	runId: string
	runNumber: number
	pairCount: number
}) {
	const t = useTranslations('Results')
	const [isPreparing, setIsPreparing] = useState(false)
	const isTooBigForExcel = pairCount > XLSX_MAX_ROWS

	async function downloadReport() {
		const { key, path } = REPORT
		setIsPreparing(true)
		const toastId = toast({
			title: t('exportPreparing'),
			description: t('exportPreparingHint'),
			isLoading: true
		})
		const result = await fetchFile(`/api/runs/${runId}/${path}`, `pairsight-run-${runNumber}`)
		dismissToast(toastId)
		setIsPreparing(false)
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
					aria-label={t('exportLabel', { number: runNumber })}
					aria-busy={isPreparing}
					disabled={isPreparing}
				>
					{isPreparing ? t('exporting') : t('export')}
					{isPreparing ? (
						<SpinnerIcon size={TRIGGER_ICON_SIZE} />
					) : (
						<DownloadIcon size={TRIGGER_ICON_SIZE} />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side="top" className="min-w-52">
				{FINDINGS.map(({ key, format, Icon }) => {
					const isDisabled = format === 'xlsx' && isTooBigForExcel
					return (
						<DropdownMenuItem
							key={key}
							asChild={!isDisabled}
							disabled={isDisabled}
							title={isDisabled ? t('exportTooBigForExcel') : undefined}
						>
							{isDisabled ? (
								<span>
									<Icon size={ICON_SIZE} className="text-text-muted" />
									{t(key)}
								</span>
							) : (
								<a href={`/api/runs/${runId}/findings?format=${format}`} download>
									<Icon size={ICON_SIZE} className="text-text-muted" />
									{t(key)}
								</a>
							)}
						</DropdownMenuItem>
					)
				})}
				{isTooBigForExcel && (
					<p className="text-text-muted max-w-52 px-2 pb-1.5 text-xs">
						{t('exportTooBigForExcel')}
					</p>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => void downloadReport()}>
					<PdfFileIcon size={ICON_SIZE} className="text-text-muted" />
					{t(REPORT.key)}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

'use client'

import { useTranslations } from 'next-intl'
import { AlertIcon } from '@/components/ui/icons'
import type { CsvParseError } from '@/server/pairsight/csv'

// Validation panels (docs/PairSight-UX-Plan.md §5): a count, what to fix, and
// the affected rows — icon and text, never color alone.

const MAX_LISTED = 20

export function useRowList() {
	const t = useTranslations('Records')
	return (rows: Array<number | string>) => {
		const listed = rows.slice(0, MAX_LISTED).join(', ')
		return rows.length > MAX_LISTED
			? `${listed} ${t('andMore', { count: rows.length - MAX_LISTED })}`
			: listed
	}
}

export function useCsvErrorMessage() {
	const t = useTranslations('CsvErrors')
	const list = useRowList()
	return (error: CsvParseError | { code: 'too_large' | 'not_csv' }) => {
		switch (error.code) {
			case 'too_many_rows':
			case 'too_many_columns':
				return t(error.code, { found: error.found, limit: error.limit })
			case 'blank_header':
				return t('blank_header', { columns: list(error.columns) })
			case 'duplicate_header':
				return t('duplicate_header', { headers: error.headers.join(', ') })
			case 'ragged_rows':
				return t('ragged_rows', { rows: list(error.rows) })
			default:
				return t(error.code)
		}
	}
}

export function ValidationPanel({ title, messages }: { title: string; messages: string[] }) {
	if (messages.length === 0) return null
	return (
		<div role="alert" className="border-danger/40 bg-danger-subtle rounded-lg border p-4">
			<p className="text-danger type-subheading flex items-center gap-2">
				<AlertIcon />
				{title}
			</p>
			<ul className="text-text type-body mt-2 ml-6 list-disc space-y-1">
				{messages.map((message) => (
					<li key={message}>{message}</li>
				))}
			</ul>
		</div>
	)
}

export const MAX_FILE_BYTES = 1_000_000

// Reads a chosen file on the client, rejecting non-CSV or oversized files
// before any upload.
export async function readCsvFile(
	file: File
): Promise<{ ok: true; text: string } | { ok: false; code: 'too_large' | 'not_csv' }> {
	if (!/\.csv$/i.test(file.name)) return { ok: false, code: 'not_csv' }
	if (file.size > MAX_FILE_BYTES) return { ok: false, code: 'too_large' }
	return { ok: true, text: await file.text() }
}

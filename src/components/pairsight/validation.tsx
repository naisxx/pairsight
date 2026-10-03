'use client'

import { useTranslations } from 'next-intl'
import { AlertIcon } from '@/components/ui/icons'
import { MAX_FILE_BYTES, tabularFormatOf } from '@/lib/pairsight/tabular-formats'
import type { TableError } from '@/server/pairsight/tabular'

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

// What's wrong with a file, as the screens say it: from reading it as a table
// (the server) or from checking it before upload (readTabularFile).
export function useFileErrorMessage() {
	const t = useTranslations('FileErrors')
	const list = useRowList()
	return (error: TableError | { code: 'too_large' }) => {
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

// Checks a chosen file before upload: a format PairSight reads
// (src/lib/pairsight/tabular-formats.ts) and within the size limit. The file
// itself is sent as is; the server reads it.
export function checkTabularFile(
	file: File
): { ok: true } | { ok: false; code: 'too_large' | 'unsupported_format' } {
	if (tabularFormatOf(file.name) == null) return { ok: false, code: 'unsupported_format' }
	if (file.size > MAX_FILE_BYTES) return { ok: false, code: 'too_large' }
	return { ok: true }
}

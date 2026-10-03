import 'server-only'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { FILE_NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { MAX_FILE_BYTES } from '@/lib/pairsight/tabular-formats'
import { readTable, type TableError, type TableResult } from '@/server/pairsight/tabular'
import { suggestReferenceColumn, suggestRole } from '@/server/pairsight/fields'

// PairSight mutations. Every action requires a signed-in user and goes through
// the owner-scoped data access in src/server/pairsight/. Validation problems
// in uploaded files are returned as data — the screens show exactly which rows
// to fix — while real failures go through AppError/captureError.

const PREVIEW_ROWS = 10
const SHEET_NAME_MAX_LENGTH = 31

export const idSchema = z.string().uuid()
export const fileNameSchema = z.string().trim().min(1).max(FILE_NAME_MAX_LENGTH)
// An uploaded file, sent as is (bytes, not text, so any format the tabular
// connector reads can come through): within the size limit, with a usable name.
// A workbook sheet's name, as the sheet picker sends it back (Excel caps names
// at 31 characters).
export const sheetSchema = z.string().min(1).max(SHEET_NAME_MAX_LENGTH).optional()
export const fileSchema = z
	.instanceof(File)
	.refine((file) => file.size <= MAX_FILE_BYTES)
	.refine((file) => fileNameSchema.safeParse(file.name).success)

// Evaluation pages render per request, but the client router keeps the pages
// it has shown for Back/Forward. After a change, purge them so going back
// never shows the configuration from before it.
export function revalidateEvaluationPages() {
	revalidatePath('/[locale]/evaluations/[id]', 'layout')
}

export async function goTo(href: string): Promise<never> {
	const locale = await getLocale()
	return redirect({ href, locale })
}

// An uploaded file read as a table, by its format (src/server/pairsight/tabular);
// `sheet` picks a workbook's sheet.
export async function readUpload(
	file: File,
	maxRows: number,
	sheet?: string
): Promise<TableResult> {
	const bytes = new Uint8Array(await file.arrayBuffer())
	return readTable({ fileName: file.name, bytes, maxRows, sheet })
}

export type FilePreview =
	| {
			ok: true
			headers: string[]
			sampleRows: string[][]
			rowCount: number
			suggestedRoles: Record<string, ReturnType<typeof suggestRole>>
			suggestedReference: string | undefined
			sheet: string | undefined
	  }
	| { ok: false; error: TableError }

// The first rows plus role suggestions, for the mapping screens.
export function previewTable(parsed: TableResult): FilePreview {
	if (!parsed.ok) return parsed
	const { headers, rows } = parsed.table
	return {
		ok: true,
		headers,
		sampleRows: rows.slice(0, PREVIEW_ROWS),
		rowCount: rows.length,
		suggestedRoles: Object.fromEntries(headers.map((header) => [header, suggestRole(header)])),
		suggestedReference: suggestReferenceColumn(headers),
		sheet: parsed.sheet
	}
}

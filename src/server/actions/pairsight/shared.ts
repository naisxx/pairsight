import 'server-only'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { FILE_NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { parseCsv, type CsvParseError } from '@/server/pairsight/csv'
import { suggestReferenceColumn, suggestRole } from '@/server/pairsight/fields'
import { LIMITS } from '@/server/pairsight/limits'

// PairSight mutations. Every action requires a signed-in user and goes through
// the owner-scoped data access in src/server/pairsight/. Validation problems
// in uploaded files are returned as data — the screens show exactly which rows
// to fix — while real failures go through AppError/captureError.

const PREVIEW_ROWS = 10

export const idSchema = z.string().uuid()
export const fileTextSchema = z.string().max(LIMITS.maxFileBytes)
export const fileNameSchema = z.string().trim().min(1).max(FILE_NAME_MAX_LENGTH)

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

export type CsvPreview =
	| {
			ok: true
			headers: string[]
			sampleRows: string[][]
			rowCount: number
			suggestedRoles: Record<string, ReturnType<typeof suggestRole>>
			suggestedReference: string | undefined
	  }
	| { ok: false; error: CsvParseError }

// The first rows plus role suggestions, for the mapping screens.
export function previewCsv(text: string, maxRows: number): CsvPreview {
	const parsed = parseCsv(text, maxRows)
	if (!parsed.ok) return parsed
	const { headers, rows } = parsed.table
	return {
		ok: true,
		headers,
		sampleRows: rows.slice(0, PREVIEW_ROWS),
		rowCount: rows.length,
		suggestedRoles: Object.fromEntries(headers.map((header) => [header, suggestRole(header)])),
		suggestedReference: suggestReferenceColumn(headers)
	}
}

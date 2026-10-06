import 'server-only'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { FILE_NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { readTable, type TableResult } from '@/server/pairsight/tabular'
import { readStoredUpload, type UploadKind } from '@/server/pairsight/uploads'

// PairSight mutations. Every action requires a signed-in user and goes through
// the owner-scoped data access in src/server/pairsight/. Validation problems
// in uploaded files are returned as data — the screens show exactly which rows
// to fix — while real failures go through AppError/captureError.

const SHEET_NAME_MAX_LENGTH = 31

export const idSchema = z.string().uuid()
export const fileNameSchema = z.string().trim().min(1).max(FILE_NAME_MAX_LENGTH)
// A workbook sheet's name, as the sheet picker sends it back (Excel caps names
// at 31 characters).
export const sheetSchema = z.string().min(1).max(SHEET_NAME_MAX_LENGTH).optional()

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

// A stored upload (src/server/pairsight/uploads.ts) read whole as a table,
// by its format; `sheet` picks a workbook's sheet. For files read whole
// (a vendor's pairs); records are read a batch at a time instead
// (src/server/pairsight/source-upload.ts).
export async function readUploadTable({
	ownerId,
	uploadId,
	kind,
	maxRows,
	sheet
}: {
	ownerId: string
	uploadId: string
	kind: UploadKind
	maxRows: number
	sheet?: string
}): Promise<TableResult & { fileName: string }> {
	const upload = await readStoredUpload({ ownerId, uploadId, kind })
	const result = await readTable({ fileName: upload.fileName, bytes: upload.bytes, maxRows, sheet })
	return { ...result, fileName: upload.fileName }
}

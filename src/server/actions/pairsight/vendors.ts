'use server'

import { z } from 'zod'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import type { TableError } from '@/server/pairsight/tabular'
import { recordIdsByReference } from '@/server/pairsight/datasets'
import { LIMITS, MAX_LISTED_ISSUES } from '@/server/pairsight/limits'
import { vendorColumnsSchema } from '@/server/pairsight/schemas'
import {
	clearDraftFile,
	confirmVendorDraft,
	createVendorDraft,
	deleteVendor,
	draftDatasetId,
	renameVendor,
	setDraftFile
} from '@/server/pairsight/vendor-exports'
import {
	detectVendorColumns,
	parseVendorFile,
	type VendorColumns,
	type VendorDetection,
	type VendorFileStats
} from '@/server/pairsight/vendors'
import { fileSchema, idSchema, readUpload, revalidateEvaluationPages, sheetSchema } from './shared'

const vendorKindSchema = z.enum(['draft', 'export'])
const vendorNameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH)

export const createVendorDraftAction = validatedAction({
	input: z.object({ evaluationId: idSchema }),
	handler: async ({ evaluationId }) => {
		const user = await requireUser()
		const draft = await createVendorDraft({ ownerId: user.id, evaluationId })
		revalidateEvaluationPages()
		return draft
	}
})

export const renameVendorAction = validatedAction({
	input: z.object({ kind: vendorKindSchema, id: idSchema, name: vendorNameSchema }),
	handler: async ({ kind, id, name }) => {
		const user = await requireUser()
		await renameVendor({ ownerId: user.id, kind, id, name })
		revalidateEvaluationPages()
		return { renamed: true }
	}
})

export const deleteVendorAction = validatedAction({
	input: z.object({ kind: vendorKindSchema, id: idSchema }),
	handler: async ({ kind, id }) => {
		const user = await requireUser()
		await deleteVendor({ ownerId: user.id, kind, id })
		revalidateEvaluationPages()
		return { deleted: true }
	}
})

export type VendorFileCheck =
	| { ok: false; parseError: TableError }
	| {
			ok: true
			headers: string[]
			// The workbook sheet read, for a file with sheets.
			sheet: string | undefined
			// The columns used: detected, or the ones the user chose.
			columns: VendorColumns | null
			// Why the columns couldn't be worked out, when they couldn't.
			detection: Extract<VendorDetection, { columns: null }> | null
			stats: VendorFileStats | null
			issues: {
				unknownReferences: Array<{ row: number; reference: string }>
				unknownCount: number
				missingReferenceRows: number[]
				missingCount: number
				tooManyPairs: boolean
			} | null
			// The file passed and is now the draft's file.
			saved: boolean
	  }

// Reads a vendor file against the source records: works out the format and
// columns (unless the user chose them), checks every reference, and keeps the
// file on the draft only if it passes.
export const checkVendorFileAction = validatedAction({
	input: z.object({
		draftId: idSchema,
		file: fileSchema,
		sheet: sheetSchema,
		columns: vendorColumnsSchema.optional()
	}),
	handler: async ({ draftId, file, sheet, columns: chosen }): Promise<VendorFileCheck> => {
		const user = await requireUser()
		const datasetId = await draftDatasetId(user.id, draftId)
		const fileName = file.name.trim()
		const parsed = await readUpload(file, LIMITS.maxPairsPerRun, sheet)
		if (!parsed.ok) {
			await clearDraftFile({ ownerId: user.id, draftId })
			revalidateEvaluationPages()
			return { ok: false, parseError: parsed.error }
		}
		const { table } = parsed
		const recordIdByReference = await recordIdsByReference(datasetId)
		const columnsExist = (columns: VendorColumns) =>
			(columns.format === 'pair'
				? [columns.columnA, columns.columnB]
				: [columns.groupColumn, columns.referenceColumn]
			).every((header) => table.headers.includes(header))
		const detected =
			chosen != null && columnsExist(chosen)
				? { columns: chosen }
				: detectVendorColumns({ table, references: new Set(recordIdByReference.keys()) })
		const base = { ok: true as const, headers: table.headers, sheet: parsed.sheet }

		if (detected.columns == null) {
			await clearDraftFile({ ownerId: user.id, draftId })
			revalidateEvaluationPages()
			return {
				...base,
				columns: null,
				detection: detected,
				stats: null,
				issues: null,
				saved: false
			}
		}
		const columns = detected.columns
		const result = parseVendorFile({
			table,
			columns,
			recordIdByReference,
			maxPairs: LIMITS.maxPairsPerRun
		})
		if (result.isValid) {
			await setDraftFile({
				ownerId: user.id,
				draftId,
				fileName,
				columns,
				pairs: result.pairs,
				stats: result.stats
			})
		} else {
			await clearDraftFile({ ownerId: user.id, draftId })
		}
		revalidateEvaluationPages()
		return {
			...base,
			columns,
			detection: null,
			stats: result.stats,
			issues: result.isValid
				? null
				: {
						unknownReferences: result.unknownReferences.slice(0, MAX_LISTED_ISSUES),
						unknownCount: result.unknownReferences.length,
						missingReferenceRows: result.missingReferenceRows.slice(0, MAX_LISTED_ISSUES),
						missingCount: result.missingReferenceRows.length,
						tooManyPairs: result.tooManyPairs
					},
			saved: result.isValid
		}
	}
})

// "This file lists every match the vendor made": the draft becomes a vendor
// the plan and runs use.
export const confirmVendorAction = validatedAction({
	input: z.object({ draftId: idSchema }),
	handler: async ({ draftId }) => {
		const user = await requireUser()
		const vendorExport = await confirmVendorDraft({ ownerId: user.id, draftId })
		revalidateEvaluationPages()
		return vendorExport
	}
})

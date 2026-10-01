'use server'

import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import { parseCsv, type CsvParseError } from '@/server/pairsight/csv'
import { LIMITS } from '@/server/pairsight/limits'
import { getCurrentDataset, recordIdsByReference } from '@/server/pairsight/datasets'
import { getOwnedEvaluation } from '@/server/pairsight/evaluations'
import { deleteVendorExport, saveVendorExport } from '@/server/pairsight/vendor-exports'
import { parseVendorPairs, type VendorPairParse } from '@/server/pairsight/vendors'
import {
	fileNameSchema,
	fileTextSchema,
	idSchema,
	previewCsv,
	revalidateEvaluationPages
} from './shared'

export const previewVendorCsv = validatedAction({
	input: z.object({ text: fileTextSchema }),
	handler: async ({ text }) => {
		await requireUser()
		// Vendor exports list matches, not records: the row cap is the pair cap.
		return previewCsv(text, LIMITS.maxPairsPerRun)
	}
})

export type SaveVendorResult =
	| { ok: true; pairCount: number; selfPairRows: number; duplicateRows: number }
	| { ok: false; parseError: CsvParseError }
	| { ok: false; issues: Omit<VendorPairParse, 'pairs'> }

export const saveVendorAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
		fileName: fileNameSchema,
		text: fileTextSchema,
		columnA: z.string().min(1),
		columnB: z.string().min(1),
		// The user confirmed the export lists every match the vendor made.
		confirmedComplete: z.literal(true)
	}),
	handler: async ({
		evaluationId,
		name,
		fileName,
		text,
		columnA,
		columnB
	}): Promise<SaveVendorResult> => {
		const user = await requireUser()
		await getOwnedEvaluation({ ownerId: user.id, id: evaluationId })
		const dataset = await getCurrentDataset(evaluationId)
		if (dataset == null) {
			throw new AppError('Upload the source records before adding vendor results.', {
				code: 'no_dataset'
			})
		}
		const parsed = parseCsv(text, LIMITS.maxPairsPerRun)
		if (!parsed.ok) return { ok: false, parseError: parsed.error }
		const result = parseVendorPairs({
			table: parsed.table,
			columnA,
			columnB,
			recordIdByReference: await recordIdsByReference(dataset.id)
		})
		if (!result.isValid) {
			return {
				ok: false,
				issues: {
					unknownReferences: result.unknownReferences,
					missingReferenceRows: result.missingReferenceRows,
					selfPairRows: result.selfPairRows,
					duplicateRows: result.duplicateRows,
					isValid: false
				}
			}
		}
		await saveVendorExport({
			ownerId: user.id,
			evaluationId,
			name,
			fileName,
			mapping: { columnA, columnB },
			pairs: result.pairs
		})
		revalidateEvaluationPages()
		return {
			ok: true,
			pairCount: result.pairs.length,
			selfPairRows: result.selfPairRows.length,
			duplicateRows: result.duplicateRows.length
		}
	}
})

export const deleteVendorAction = validatedAction({
	input: z.object({ exportId: idSchema }),
	handler: async ({ exportId }) => {
		const user = await requireUser()
		await deleteVendorExport({ ownerId: user.id, exportId })
		revalidateEvaluationPages()
		return { deleted: true }
	}
})

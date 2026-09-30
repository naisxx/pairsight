'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import {
	parseCsv,
	validateSourceRecords,
	type CsvParseError,
	type ReferenceIssues
} from '@/server/pairsight/csv'
import { duplicateRoles } from '@/server/pairsight/fields'
import { LIMITS } from '@/server/pairsight/limits'
import { columnRolesSchema } from '@/server/pairsight/schemas'
import { saveSourceDataset } from '@/server/pairsight/datasets'
import {
	fileNameSchema,
	fileTextSchema,
	idSchema,
	previewCsv,
	revalidateEvaluationPages
} from './shared'

export const previewSourceCsv = validatedAction({
	input: z.object({ text: fileTextSchema }),
	handler: async ({ text }) => {
		await requireUser()
		return previewCsv(text, LIMITS.maxSourceRecords)
	}
})

export type SaveSourceResult =
	| { ok: true; rowCount: number }
	| { ok: false; parseError: CsvParseError }
	| {
			ok: false
			referenceIssues: ReferenceIssues
			duplicateRoles: string[]
			missingReferenceColumn: boolean
	  }

export const saveSourceAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		fileName: fileNameSchema,
		text: fileTextSchema,
		referenceColumn: z.string().min(1),
		columnRoles: columnRolesSchema
	}),
	handler: async ({
		evaluationId,
		fileName,
		text,
		referenceColumn,
		columnRoles
	}): Promise<SaveSourceResult> => {
		const user = await requireUser()
		const parsed = parseCsv(text)
		if (!parsed.ok) return { ok: false, parseError: parsed.error }
		const validation = validateSourceRecords({ table: parsed.table, referenceColumn })
		const roles = Object.fromEntries(
			Object.entries(columnRoles).filter(
				([header]) => header !== referenceColumn && parsed.table.headers.includes(header)
			)
		)
		const duplicated = duplicateRoles(roles)
		if (!validation.isValid || duplicated.length > 0) {
			return {
				ok: false,
				referenceIssues: validation.issues,
				duplicateRoles: duplicated,
				missingReferenceColumn: !parsed.table.headers.includes(referenceColumn)
			}
		}
		await saveSourceDataset({
			ownerId: user.id,
			evaluationId,
			fileName,
			referenceColumn,
			columnRoles: roles,
			records: validation.records
		})
		revalidateEvaluationPages()
		return { ok: true, rowCount: validation.records.length }
	}
})

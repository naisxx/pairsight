'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import {
	checkColumns,
	validateSourceRecords,
	type ColumnCheck,
	type ReferenceIssues
} from '@/server/pairsight/source-records'
import type { TableError } from '@/server/pairsight/tabular'
import { duplicateRoles } from '@/server/pairsight/fields'
import { LIMITS } from '@/server/pairsight/limits'
import { columnRolesSchema, entityTypeSchema } from '@/server/pairsight/schemas'
import { rolesFor } from '@/lib/pairsight/entity-types'
import { saveSourceDataset } from '@/server/pairsight/datasets'
import {
	fileSchema,
	idSchema,
	sheetSchema,
	previewTable,
	readUpload,
	revalidateEvaluationPages,
	type FilePreview
} from './shared'

// Problem rows listed per column; the panel shows a few and counts the rest.
const MAX_LISTED_ISSUES = 20

export type SourcePreview =
	| (Extract<FilePreview, { ok: true }> & { columnChecks: Record<string, ColumnCheck> })
	| Extract<FilePreview, { ok: false }>

export const previewSourceFile = validatedAction({
	input: z.object({ file: fileSchema, sheet: sheetSchema }),
	handler: async ({ file, sheet }): Promise<SourcePreview> => {
		await requireUser()
		const parsed = await readUpload(file, LIMITS.maxSourceRecords, sheet)
		if (!parsed.ok) return parsed
		const preview = previewTable(parsed)
		if (!preview.ok) return preview
		return { ...preview, columnChecks: checkColumns(parsed.table, MAX_LISTED_ISSUES) }
	}
})

export type SaveSourceResult =
	| { ok: true; rowCount: number }
	| { ok: false; parseError: TableError }
	| {
			ok: false
			referenceIssues: ReferenceIssues
			duplicateRoles: string[]
			missingReferenceColumn: boolean
	  }

export const saveSourceAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		file: fileSchema,
		sheet: sheetSchema,
		referenceColumn: z.string().min(1),
		columnRoles: columnRolesSchema,
		entityType: entityTypeSchema
	}),
	handler: async ({
		evaluationId,
		file,
		sheet,
		referenceColumn,
		columnRoles,
		entityType
	}): Promise<SaveSourceResult> => {
		const user = await requireUser()
		const parsed = await readUpload(file, LIMITS.maxSourceRecords, sheet)
		if (!parsed.ok) return { ok: false, parseError: parsed.error }
		const validation = validateSourceRecords({ table: parsed.table, referenceColumn })
		// Only this type's fields count; a role from another type is "not used".
		const typeRoles = new Set<string>(rolesFor(entityType))
		const roles = Object.fromEntries(
			Object.entries(columnRoles)
				.filter(([header]) => header !== referenceColumn && parsed.table.headers.includes(header))
				.map(([header, role]) => [header, typeRoles.has(role) ? role : 'other'] as const)
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
			fileName: file.name.trim(),
			referenceColumn,
			columnRoles: roles,
			records: validation.records,
			entityType
		})
		revalidateEvaluationPages()
		return { ok: true, rowCount: validation.records.length }
	}
})

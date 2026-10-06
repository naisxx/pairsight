'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import { columnRolesSchema, entityTypeSchema } from '@/server/pairsight/schemas'
import {
	previewSourceUpload,
	saveSourceUpload,
	type SaveSourceResult,
	type SourcePreview
} from '@/server/pairsight/source-upload'
import { idSchema, revalidateEvaluationPages, sheetSchema } from './shared'

export type { SaveSourceResult, SourcePreview } from '@/server/pairsight/source-upload'

// The records screen: an uploaded file (PUT /api/evaluations/[id]/uploads)
// previewed, then saved with the chosen ID column and fields
// (src/server/pairsight/source-upload.ts).

export const previewSourceFile = validatedAction({
	input: z.object({ uploadId: idSchema, sheet: sheetSchema }),
	handler: async ({ uploadId, sheet }): Promise<SourcePreview> => {
		const user = await requireUser()
		return previewSourceUpload({ ownerId: user.id, uploadId, sheet })
	}
})

export const saveSourceAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		uploadId: idSchema,
		sheet: sheetSchema,
		referenceColumn: z.string().min(1),
		columnRoles: columnRolesSchema,
		entityType: entityTypeSchema
	}),
	handler: async (input): Promise<SaveSourceResult> => {
		const user = await requireUser()
		const result = await saveSourceUpload({ ownerId: user.id, ...input })
		if (result.ok) revalidateEvaluationPages()
		return result
	}
})

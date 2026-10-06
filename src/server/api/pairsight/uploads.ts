import 'server-only'
import { z } from 'zod'
import { requireUser } from '@/server/auth/session'
import { fileNameSchema } from '@/server/actions/pairsight/shared'
import { readLimited, storeUpload } from '@/server/pairsight/uploads'

// PUT /api/evaluations/[id]/uploads?kind=records|vendor&fileName=…: a file as
// the raw request body, kept for the owner to check and save
// (src/server/pairsight/uploads.ts). Answers the id the screens use from then
// on instead of sending the file again.

export const uploadInput = z.object({
	id: z.string().uuid(),
	kind: z.enum(['records', 'vendor']),
	fileName: fileNameSchema
})

export async function uploadFile(
	{ id, kind, fileName }: z.infer<typeof uploadInput>,
	body: ReadableStream<Uint8Array> | null
): Promise<{ uploadId: string }> {
	const user = await requireUser()
	const bytes = await readLimited(body)
	const uploadId = await storeUpload({ ownerId: user.id, evaluationId: id, kind, fileName, bytes })
	return { uploadId }
}

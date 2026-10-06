import 'server-only'
import { AppError } from '@/lib/errors/app-error'
import { MAX_FILE_BYTES } from '@/lib/pairsight/tabular-formats'
import { db } from '@/server/db/client'
import { getOwnedEvaluation } from './evaluations'

// Uploaded files, kept while they're checked (docs/PairSight-Scale-Roadmap.md,
// item 3): a file is sent once, and every preview, sheet pick and column
// change reads it from here instead of the browser sending it again. Gone
// once its records or pairs are saved, or after a day.

export type UploadKind = 'records' | 'vendor'

// How long an upload nobody saved is kept.
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000
// How long a dataset may stay half-written before it's taken for a save
// that failed part-way.
const UNSAVED_DATASET_TTL_MS = 60 * 60 * 1000

export function fileTooLarge() {
	return new AppError('That file is too big to upload. Split it, or save it as a smaller CSV.', {
		status: 413,
		code: 'too_large'
	})
}

export function uploadNotFound() {
	return new AppError('That upload has expired. Choose the file again.', {
		status: 404,
		code: 'upload_not_found'
	})
}

// A request body read whole, refusing it as soon as it passes the size limit
// rather than after it has all arrived.
export async function readLimited(
	body: ReadableStream<Uint8Array> | null
): Promise<Uint8Array<ArrayBuffer>> {
	if (body == null) return new Uint8Array()
	const chunks: Uint8Array[] = []
	let size = 0
	const reader = body.getReader()
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.length
		if (size > MAX_FILE_BYTES) {
			await reader.cancel()
			throw fileTooLarge()
		}
		chunks.push(value)
	}
	const bytes = new Uint8Array(size)
	let at = 0
	for (const chunk of chunks) {
		bytes.set(chunk, at)
		at += chunk.length
	}
	return bytes
}

export async function storeUpload({
	ownerId,
	evaluationId,
	kind,
	fileName,
	bytes
}: {
	ownerId: string
	evaluationId: string
	kind: UploadKind
	fileName: string
	bytes: Uint8Array<ArrayBuffer>
}): Promise<string> {
	// Only into the owner's own evaluation; throws a 404 otherwise.
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	const upload = await db.upload.create({
		data: { ownerId, evaluationId, kind, fileName, size: bytes.length, bytes },
		select: { id: true }
	})
	return upload.id
}

// The owner's upload, with its bytes. A missing or someone else's upload is
// "expired": an id never confirms another person's file.
export async function readStoredUpload({
	ownerId,
	uploadId,
	kind
}: {
	ownerId: string
	uploadId: string
	kind: UploadKind
}): Promise<{ evaluationId: string; fileName: string; bytes: Uint8Array }> {
	const upload = await db.upload.findFirst({
		where: { id: uploadId, ownerId, kind },
		select: { evaluationId: true, fileName: true, bytes: true }
	})
	if (upload == null) throw uploadNotFound()
	return { ...upload, bytes: new Uint8Array(upload.bytes) }
}

export async function deleteUpload(uploadId: string) {
	await db.upload.deleteMany({ where: { id: uploadId } })
}

// Uploads nobody saved, and datasets a failed save left half-written:
// cleared by the run worker every so often.
export async function sweepUploads(now = new Date()) {
	const [uploads, datasets] = await Promise.all([
		db.upload.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - UPLOAD_TTL_MS) } } }),
		db.sourceDataset.deleteMany({
			where: {
				savedAt: null,
				createdAt: { lt: new Date(now.getTime() - UNSAVED_DATASET_TTL_MS) }
			}
		})
	])
	return { uploads: uploads.count, datasets: datasets.count }
}

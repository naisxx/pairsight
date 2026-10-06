'use client'

import { z } from 'zod'

// Sends a file once, as is, to be kept while it's checked
// (PUT /api/evaluations/[id]/uploads, src/server/api/pairsight/uploads.ts);
// every preview and save after that names it by id instead of sending it
// again. XMLHttpRequest rather than fetch, for upload progress.

export type UploadResult =
	| { ok: true; uploadId: string }
	// `tooLarge`: past the size limit, said plainly; otherwise the server's
	// message, or none when the connection failed.
	| { ok: false; tooLarge: boolean; message: string | null }

const HTTP_OK_MIN = 200
const HTTP_OK_MAX = 299
const HTTP_TOO_LARGE = 413
const PERCENT = 100

const successSchema = z.object({ uploadId: z.string().uuid() })
const failureSchema = z.object({ error: z.string() })

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

export function uploadFile({
	evaluationId,
	kind,
	file,
	onProgress
}: {
	evaluationId: string
	kind: 'records' | 'vendor'
	file: File
	// 0–100 as the file goes up.
	onProgress?: (percent: number) => void
}): Promise<UploadResult> {
	const query = new URLSearchParams({ kind, fileName: file.name })
	return new Promise((resolve) => {
		const request = new XMLHttpRequest()
		request.open('PUT', `/api/evaluations/${evaluationId}/uploads?${query}`)
		request.setRequestHeader('Content-Type', 'application/octet-stream')
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * PERCENT))
		}
		request.onload = () => {
			const body = parseJson(request.responseText)
			if (request.status >= HTTP_OK_MIN && request.status <= HTTP_OK_MAX) {
				const parsed = successSchema.safeParse(body)
				if (parsed.success) return resolve({ ok: true, uploadId: parsed.data.uploadId })
			}
			resolve({
				ok: false,
				tooLarge: request.status === HTTP_TOO_LARGE,
				message: failureSchema.safeParse(body).data?.error ?? null
			})
		}
		request.onerror = () => resolve({ ok: false, tooLarge: false, message: null })
		request.send(file)
	})
}

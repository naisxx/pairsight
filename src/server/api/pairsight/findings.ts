import 'server-only'
import { z } from 'zod'
import { findingsExport } from '@/server/pairsight/findings'
import type { DownloadFile } from '../route-factory'
import { resolveRunScope } from './run-scope'

// GET /api/runs/[runId]/findings?format=csv|xlsx: a run's findings as a file.

export const findingsInput = z.object({
	runId: z.string().uuid(),
	format: z.enum(['csv', 'xlsx']).default('csv')
})

export async function findingsDownload({
	runId,
	format
}: z.infer<typeof findingsInput>): Promise<DownloadFile> {
	return findingsExport({ scope: await resolveRunScope(runId), runId, format })
}

import 'server-only'
import { z } from 'zod'
import { summaryExport } from '@/server/pairsight/report-pdf/render'
import type { DownloadFile } from '../route-factory'
import { resolveRunScope } from './run-scope'

// GET /api/runs/[runId]/summary: a run's summary report as a PDF.

export const summaryInput = z.object({ runId: z.string().uuid() })

export async function summaryDownload({
	runId
}: z.infer<typeof summaryInput>): Promise<DownloadFile> {
	return summaryExport({ scope: await resolveRunScope(runId), runId })
}

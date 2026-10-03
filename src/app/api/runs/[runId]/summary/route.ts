import { summaryDownload, summaryInput } from '@/server/api/pairsight/summary'
import { createDownloadRoute } from '@/server/api/route-factory'

export const GET = createDownloadRoute({ input: summaryInput, handler: summaryDownload })

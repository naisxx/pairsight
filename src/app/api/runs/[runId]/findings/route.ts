import { findingsDownload, findingsInput } from '@/server/api/pairsight/findings'
import { createDownloadRoute } from '@/server/api/route-factory'

export const GET = createDownloadRoute({ input: findingsInput, handler: findingsDownload })

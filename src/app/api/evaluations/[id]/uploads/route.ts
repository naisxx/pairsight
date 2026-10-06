import { uploadFile, uploadInput } from '@/server/api/pairsight/uploads'
import { createUploadRoute } from '@/server/api/route-factory'

export const PUT = createUploadRoute({ input: uploadInput, handler: uploadFile })

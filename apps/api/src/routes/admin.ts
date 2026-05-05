import { Router } from 'express'

import { adminTokenMiddleware } from '../middleware/admin.ts'
import * as adminController from '../controllers/admin.controller.ts'

const router = Router()

router.post(
  '/backfill-premade-embeddings',
  adminTokenMiddleware,
  adminController.backfillPremadeEmbeddings,
)

export default router

import type { RequestHandler } from 'express'

import { listLeechesQuerySchema, leechIdParamSchema } from '../schemas/leech.schema.ts'
import * as leechService from '../services/leech.service.ts'

export const list: RequestHandler = async (req, res): Promise<void> => {
  const params = listLeechesQuerySchema.parse(req.query)
  const result = await leechService.listLeeches(req.user.id, params)
  res.json(result)
}

export const get: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  const leech  = await leechService.getLeechById(req.user.id, id)
  res.json(leech)
}

export const resolve: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  const leech  = await leechService.resolveLeech(req.user.id, id)
  res.json(leech)
}

export const reopen: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  const leech  = await leechService.reopenLeech(req.user.id, id)
  res.json(leech)
}

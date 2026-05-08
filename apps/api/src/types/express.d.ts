import type { User } from '@supabase/supabase-js'
import type { Logger } from 'pino'

declare global {
  namespace Express {
    interface Request {
      /** Set by authMiddleware after successful JWT verification. */
      user: User
      /** Set by pino-http requestLogger; widened to optional so the global
       *  errorHandler can fall back when an error fires before the middleware ran. */
      log: Logger | undefined
      /** AbortSignal that aborts when the underlying socket is destroyed
       *  (client disconnect or server.requestTimeout). Available on Node 18+
       *  via IncomingMessage.signal but not surfaced by @types/express;
       *  declared here for use by handlers that thread `req.signal` to
       *  downstream calls (currently OpenAI). */
      signal: AbortSignal
    }
  }
}

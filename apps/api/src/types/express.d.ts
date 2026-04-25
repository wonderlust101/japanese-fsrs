import type { User } from '@supabase/supabase-js'

declare global {
  namespace Express {
    interface Request {
      /** Set by authMiddleware after successful JWT verification. */
      user: User
    }
  }
}

import type { z } from 'zod'

import type { ProfileSchema } from './schemas/api.schema.ts'

/**
 * User profile (wire-format). `interests` is synthesised at the API boundary
 * from the `user_interests` junction table; not a column on `profiles`.
 * See apps/api/src/services/profile.service.ts.
 */
export type Profile = z.infer<typeof ProfileSchema>

// `UpdateProfileInput` is sourced from the Zod schema at
// shared-types/src/schemas/profile.schema.ts (re-exported from index.ts).

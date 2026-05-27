import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

// Only the public (marketing) surface belongs in the sitemap. The (app),
// (auth), and onboarding trees are all `noindex` (and the app/auth trees are
// disallowed in robots.ts), so they intentionally stay out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL
  const now = new Date()
  return [
    { url: base,              lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/help`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}

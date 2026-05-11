import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
  ]
  // TODO(seo): when a public landing page lands, expand with /features, /pricing,
  // /privacy, /help, etc. Authenticated routes intentionally stay out — they're
  // also blocked in robots.ts.
}

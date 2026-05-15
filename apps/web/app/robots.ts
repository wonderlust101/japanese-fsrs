import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

// Belt-and-suspenders with the per-layout `robots: { index: false }` on the
// auth/onboarding/(app) trees: meta tags catch crawlers that load the page,
// robots.txt catches crawlers that read it before fetching.
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/signup',
          '/onboarding',
          '/today',
          '/add',
          '/decks',
          '/cards',
          '/review',
          '/insights',
          '/settings',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

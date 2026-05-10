import type { MetadataRoute } from 'next'

// Belt-and-suspenders with the per-layout `robots: { index: false }` on the
// auth/onboarding/(app) trees: meta tags catch crawlers that load the page,
// robots.txt catches crawlers that read it before fetching.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/signup',
          '/onboarding',
          '/dashboard',
          '/decks',
          '/review',
          '/analytics',
          '/settings',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

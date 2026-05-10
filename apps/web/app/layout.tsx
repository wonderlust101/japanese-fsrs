import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono, Noto_Sans_JP } from 'next/font/google'
import { FloatingLauncher } from '@/components/dev/FloatingLauncher'
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const SITE_DESCRIPTION =
  'AI-enhanced spaced repetition for Japanese. Learn kanji, vocabulary, and grammar with FSRS scheduling tuned for the way Japanese forgetting curves actually behave.'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans-loaded',
  display: 'swap',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp-loaded',
  display: 'swap',
})

// Bricolage Grotesque is the new display face. Variable across weight (200-800)
// and width axes; we let the variable file handle hierarchy without specifying
// fixed weights. Replaces DM Serif Display (Iwanami-era) entirely.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage-loaded',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono-loaded',
  display: 'swap',
})

// Title convention: every page.tsx (or per-segment layout.tsx, when the page is
// a client component) exports `metadata: { title: 'Sentence case' }`. The root
// template below turns that into `Sentence case | Tomo`. Do NOT redefine
// `title.template` in any child layout — it overrides this one entirely rather
// than extending it, which is how the brand drift to "TOMO" originally happened.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s | Tomo',
    default: 'Tomo · Spaced repetition for Japanese',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Tomo',
  authors: [{ name: 'Tomo' }],
  keywords: ['Japanese', 'spaced repetition', 'FSRS', 'kanji', 'vocabulary', 'JLPT', 'flashcards'],
  icons: {
    icon: [
      { url: '/brand/favicon.ico', sizes: 'any' },
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Tomo',
    title: 'Tomo · Spaced repetition for Japanese',
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
    images: [
      { url: '/brand/og.png', width: 1200, height: 630, alt: 'Tomo — Spaced repetition for Japanese' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tomo · Spaced repetition for Japanese',
    description: SITE_DESCRIPTION,
    images: ['/brand/og.png'],
  },
  robots: { index: true, follow: true },
}

// Theme color and color-scheme moved out of `metadata` in Next.js 15 — they
// now live on the dedicated `viewport` export.
export const viewport: Viewport = {
  themeColor: '#F4F1EC', // matches --color-cool-paper-base from globals.css
  colorScheme: 'light',
}

// TODO(seo): The following are intentionally deferred. Pick up when a public
// marketing surface (landing page) lands.
//   1. PWA web manifest — create app/manifest.ts so Tomo is installable on
//      mobile/desktop. Useful for a daily-use study app. Generate maskable +
//      monochrome icon variants from logo.svg.
//   2. Dynamic OG images — app/decks/[id]/opengraph-image.tsx using next/og to
//      auto-render share cards per deck. Only valuable once decks become
//      publicly shareable (currently auth-gated, no shared URLs).
//   3. JSON-LD structured data — Organization + SoftwareApplication schemas on
//      a public landing page so Google can show rich results.
//   4. Public landing page — replace the / → /onboarding redirect with a real
//      marketing page; add /features, /privacy, /help; expand sitemap.ts.

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${bricolage.variable} ${notoSansJP.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <QueryProvider>
          {children}
          <FloatingLauncher />
        </QueryProvider>
</body>
    </html>
  )
}

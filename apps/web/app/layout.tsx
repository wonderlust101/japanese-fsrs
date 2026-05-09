import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono, Noto_Sans_JP } from 'next/font/google'
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

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

export const metadata: Metadata = {
  title: 'FSRS Japanese',
  description: 'A spaced repetition study tool for Japanese',
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${bricolage.variable} ${notoSansJP.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
</body>
    </html>
  )
}

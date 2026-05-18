import type { Metadata } from 'next'
import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { PageHeader } from '@/components/ui/PageHeader'

import { PremadeCatalogue } from './_components/premade-catalogue'

export const metadata: Metadata = { title: 'Premade decks' }

export default function PremadeDecksPage(): React.JSX.Element {
  return (
    <>
      <TopBar>
        <Link
          href="/decks"
          className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          <span aria-hidden="true">←</span>
          <span>Decks</span>
        </Link>
        <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
        <h1 className="flex-1 truncate text-base font-semibold text-sumi-ink">
          Premade decks
        </h1>
      </TopBar>

      <div className="min-h-screen bg-cool-paper-base pb-32">
        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="pt-6 pb-4 sm:pt-8 sm:pb-5 lg:pt-10 lg:pb-6">
            <PageHeader
              kanji="集"
              label="Premade decks · curated by Tomo"
              title="Find a deck to start with."
              subtitle="Curated starter decks for JLPT N5 through N1, plus thematic collections. Add one to your library and Tomo creates a personal copy you can study, edit, and pause."
            />
          </div>

          <PremadeCatalogue />
        </div>
      </div>
    </>
  )
}

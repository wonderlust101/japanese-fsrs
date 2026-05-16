import type { Metadata } from 'next'
import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata: Metadata = { title: 'Premade decks' }

export default function PremadeDecksPage(): React.JSX.Element {
  return (
    <>
      <TopBar>
        <h1 className="flex-1 text-base font-semibold text-sumi-ink">Premade decks</h1>
        <Link href="/decks">
          <Button size="sm" variant="ghost">Back to my decks</Button>
        </Link>
      </TopBar>

      <div className="min-h-screen bg-cool-paper-base pb-32">
        <div className="relative mx-auto max-w-[1440px] px-6 md:px-12 lg:px-16">
          <span aria-hidden="true" className="block h-[2px] w-full bg-inari-vermillion" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-inari-vermillion"
          />

          <div className="pt-10 lg:pt-14">
            <PageHeader
              kanji="集"
              label="Premade decks · curated by Tomo"
              title="Find a deck to start with."
              subtitle="Curated decks for JLPT N5 through N1, plus thematic collections for everyday Japanese. Subscribe and Tomo creates a personal copy you can study and edit."
            />

            <div className="mt-12 rounded-[2px] border border-soft-hairline bg-cream-inset/55 p-8 text-center sm:p-12">
              <p className="font-display text-xl text-sumi-ink">Coming soon.</p>
              <p className="mx-auto mt-2 max-w-[52ch] text-sm text-faded-sumi">
                Tomo&rsquo;s curated decks are still being shaped. While we finish, you can build your own deck from the library, or add a word from Add Japanese.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Link href="/decks">
                  <Button size="md" variant="secondary">Back to my decks</Button>
                </Link>
                <Link href="/add">
                  <Button size="md" variant="ghost">Add a word instead</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

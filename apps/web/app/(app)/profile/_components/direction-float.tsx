'use client'

import { ProfileCard } from './profile-card'
import {
  FactLine,
  IdentityHeading,
  KitsuneSeal,
  SiblingTeaser,
} from './profile-fragments'
import {
  formatJlptLevel,
  formatJoinedMonth,
  type ProfileDirectionProps,
} from './profile-shared'

/**
 * V6 — Asymmetric Float.
 *
 * Three cards positioned independently on the page, not stacked and not
 * gridded. The identity card sits upper-left; one sibling sits upper-right;
 * the other sibling sits lower-center. Negative space between them. Reads
 * as a quiet constellation: identity is the anchor, future scope orbits.
 *
 * On mobile (< sm) the asymmetric positioning collapses to a vertical
 * stack because absolute positioning at narrow widths would crash the
 * cards into each other. The mobile fallback keeps the same content
 * order: identity, then sibling 1, then sibling 2.
 */
export function DirectionFloat({
  profile, displayName, joinedAt,
}: ProfileDirectionProps): React.JSX.Element {
  const targetLabel = formatJlptLevel(profile.jlptTarget)
  const joinedLabel = formatJoinedMonth(joinedAt)

  return (
    <main className="mx-auto w-full max-w-[68rem] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      {/* Mobile: stacked. Desktop: positioned float. */}
      <div className="flex flex-col gap-4 sm:hidden">
        <ProfileCard
          tone="foreground"
          ariaLabelledBy="profile-float-mobile-name"
          className="relative px-6 py-7"
        >
          <IdentityHeading id="profile-float-mobile-name" name={displayName} />
          <div className="mt-5">
            <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} />
          </div>
          <KitsuneSeal className="absolute right-6 bottom-5" />
        </ProfileCard>
        <ProfileCard
          href="/decks/browse"
          tone="middle"
          ariaLabel="Library, browse decks to add to your shelf"
          className="px-5 py-4"
        >
          <SiblingTeaser label="Library" body="Browse decks to add to your shelf" />
        </ProfileCard>
        <ProfileCard
          href="/decks"
          tone="middle"
          ariaLabel="Kanji catalog, begin practising to track kanji"
          className="px-5 py-4"
        >
          <SiblingTeaser label="Kanji catalog" body="Begin practising to track kanji" />
        </ProfileCard>
      </div>

      <div className="relative mx-auto hidden h-[32rem] w-full max-w-[48rem] sm:block">
        <ProfileCard
          tone="foreground"
          ariaLabelledBy="profile-float-name"
          className="absolute left-0 top-[6%] w-[60%] px-6 py-7 sm:px-7 sm:py-8"
        >
          <IdentityHeading id="profile-float-name" name={displayName} />
          <div className="mt-5">
            <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} stacked />
          </div>
          <KitsuneSeal className="absolute right-6 bottom-5 sm:right-7 sm:bottom-7" />
        </ProfileCard>

        <ProfileCard
          href="/decks"
          tone="middle"
          ariaLabel="Kanji catalog, begin practising to track kanji"
          className="absolute right-0 top-[16%] w-[36%] px-5 py-5"
        >
          <SiblingTeaser label="Kanji catalog" body="Begin practising to track kanji" />
        </ProfileCard>

        <ProfileCard
          href="/decks/browse"
          tone="middle"
          ariaLabel="Library, browse decks to add to your shelf"
          className="absolute bottom-[6%] left-[26%] w-[44%] px-5 py-5"
        >
          <SiblingTeaser label="Library" body="Browse decks to add to your shelf" />
        </ProfileCard>
      </div>
    </main>
  )
}

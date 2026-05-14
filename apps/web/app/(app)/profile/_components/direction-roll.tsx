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
 * V4 — Identity Roll.
 *
 * The identity card holds the page's primary mass; a narrower right column
 * carries a vertical roll of small future-feature cards. Two sibling cards
 * in the roll (not three: per V3's decision, no Settings shortcut on
 * Profile). The identity card is naturally taller than the column sum;
 * the asymmetry reads as the identity being the page's anchor.
 */
export function DirectionRoll({
  profile, displayName, joinedAt,
}: ProfileDirectionProps): React.JSX.Element {
  const targetLabel = formatJlptLevel(profile.jlptTarget)
  const joinedLabel = formatJoinedMonth(joinedAt)

  return (
    <main className="mx-auto w-full max-w-[68rem] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-6">
        <ProfileCard
          tone="foreground"
          ariaLabelledBy="profile-roll-name"
          className="relative px-7 py-8 sm:px-8 sm:py-10"
        >
          <IdentityHeading id="profile-roll-name" name={displayName} />
          <div className="mt-6">
            <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} stacked />
          </div>
          <KitsuneSeal className="absolute right-7 bottom-6 sm:right-8 sm:bottom-8" />
        </ProfileCard>

        <div className="flex flex-col gap-3">
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
      </div>
    </main>
  )
}

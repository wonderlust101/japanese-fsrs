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
 * V3 — Hero + Bento.
 *
 * A primary identity hero card on top, then an asymmetric bento row below
 * with two sibling cards in unequal proportions: Library wider (3fr), Kanji
 * catalog narrower (2fr). Reads top-to-bottom: who you are, then what's
 * coming. The hero is comfortable but not generous; the bento gives the
 * page rhythm by varying card sizes.
 */
export function DirectionBento({
  profile, displayName, joinedAt,
}: ProfileDirectionProps): React.JSX.Element {
  const targetLabel = formatJlptLevel(profile.jlptTarget)
  const joinedLabel = formatJoinedMonth(joinedAt)

  return (
    <main className="mx-auto w-full max-w-[58rem] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <ProfileCard
        tone="foreground"
        ariaLabelledBy="profile-bento-name"
        className="relative px-6 py-7 sm:px-8 sm:py-9"
      >
        <IdentityHeading id="profile-bento-name" name={displayName} />
        <div className="mt-5">
          <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} />
        </div>
        <KitsuneSeal className="absolute right-6 bottom-5 sm:right-8 sm:bottom-7" />
      </ProfileCard>

      <div className="mt-5 grid gap-4 sm:grid-cols-[3fr_2fr]">
        <ProfileCard
          href="/decks/browse"
          tone="middle"
          ariaLabel="Library, browse decks to add to your shelf"
          className="px-5 py-5 sm:px-6 sm:py-6"
        >
          <SiblingTeaser label="Library" body="Browse decks to add to your shelf" />
        </ProfileCard>

        <ProfileCard
          href="/decks"
          tone="middle"
          ariaLabel="Kanji catalog, begin practising to track kanji"
          className="px-5 py-5 sm:px-6 sm:py-6"
        >
          <SiblingTeaser label="Kanji catalog" body="Begin practising to track kanji" />
        </ProfileCard>
      </div>
    </main>
  )
}

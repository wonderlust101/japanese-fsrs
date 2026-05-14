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
 * V1 — Stacked Trio.
 *
 * Three overlapping cards in a z-axis stack. The literal Card-Stack identity
 * from DESIGN.md: foreground card is the user, two faded sibling cards behind
 * teaser future scope. Reads as "your current pass and the passes Tomo is
 * preparing for you next."
 */
export function DirectionStack({
  profile, displayName, joinedAt,
}: ProfileDirectionProps): React.JSX.Element {
  const targetLabel = formatJlptLevel(profile.jlptTarget)
  const joinedLabel = formatJoinedMonth(joinedAt)

  return (
    <main className="mx-auto w-full max-w-[68rem] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
      <div className="relative mx-auto w-full max-w-[40rem] h-[26rem] sm:h-[28rem]">
        <ProfileCard
          href="/decks/browse"
          tone="back"
          ariaLabel="Library, browse decks to add to your shelf"
          className="absolute left-[6%] right-[6%] top-[3%] rotate-[-2.2deg] z-10 px-5 py-4"
        >
          <SiblingTeaser label="Library" body="Browse decks to add to your shelf" />
        </ProfileCard>

        <ProfileCard
          href="/decks"
          tone="middle"
          ariaLabel="Kanji catalog, begin practising to track kanji"
          className="absolute left-[3%] right-[3%] top-[12%] rotate-[1.8deg] z-20 px-5 py-4"
        >
          <SiblingTeaser label="Kanji catalog" body="Begin practising to track kanji" />
        </ProfileCard>

        <ProfileCard
          tone="foreground"
          ariaLabelledBy="profile-stack-name"
          className="absolute left-0 right-0 top-[24%] rotate-[-0.4deg] z-30 px-6 py-7 sm:px-8 sm:py-9"
        >
          <IdentityHeading id="profile-stack-name" name={displayName} />
          <div className="mt-5">
            <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} />
          </div>
          <KitsuneSeal className="absolute right-6 bottom-5 sm:right-8 sm:bottom-7" />
        </ProfileCard>
      </div>
    </main>
  )
}

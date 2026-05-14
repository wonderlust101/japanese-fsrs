'use client'

import { ProfileCard } from './profile-card'
import {
  FactLine,
  IdentityHeading,
  KitsuneSeal,
} from './profile-fragments'
import {
  formatJlptLevel,
  formatJoinedMonth,
  type ProfileDirectionProps,
} from './profile-shared'

/**
 * V5 — Wide Postcard.
 *
 * One single wide card spanning the page, internally divided into two
 * columns: identity facts on the left, a tiny three-card mini-stack on the
 * right. Single card, but the inside reads as a spread. The mini-stack is
 * decorative only; no real data, no interaction. It functions as a quiet
 * "and behind you, the deck" cue that fits the postcard metaphor.
 */
export function DirectionPostcard({
  profile, displayName, joinedAt,
}: ProfileDirectionProps): React.JSX.Element {
  const targetLabel = formatJlptLevel(profile.jlptTarget)
  const joinedLabel = formatJoinedMonth(joinedAt)

  return (
    <main className="mx-auto w-full max-w-[64rem] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
      <ProfileCard
        tone="foreground"
        ariaLabelledBy="profile-postcard-name"
        className="relative px-7 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-14"
      >
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-14">
          <div className="min-w-0">
            <IdentityHeading id="profile-postcard-name" name={displayName} size="lg" />
            <div className="mt-7">
              <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} stacked />
            </div>
            <KitsuneSeal className="mt-8 block" size="md" />
          </div>

          <MiniCardStack />
        </div>
      </ProfileCard>
    </main>
  )
}

/**
 * Decorative mini three-card stack rendered as the postcard's right column.
 * No interaction, no data; purely a visual cue that the foreground card is
 * one of many that the system holds for the learner. Sized small (~80px
 * stack) so it doesn't pull attention from the identity facts.
 */
function MiniCardStack(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex h-[10rem] w-full max-w-[12rem] items-center justify-center sm:h-[12rem]"
    >
      <span className="absolute left-[18%] top-[18%] h-[3.5rem] w-[5rem] rotate-[-6deg] rounded-[2px] border border-soft-hairline border-t-[2px] border-t-inari-vermillion/25 bg-warm-paper-base sm:h-[4.5rem] sm:w-[6.5rem]" />
      <span className="absolute left-[28%] top-[30%] h-[3.5rem] w-[5rem] rotate-[3deg] rounded-[2px] border border-soft-hairline border-t-[2px] border-t-inari-vermillion/45 bg-warm-paper-raised sm:h-[4.5rem] sm:w-[6.5rem]" />
      <span className="absolute left-[20%] top-[44%] h-[3.5rem] w-[5rem] rotate-[-2deg] rounded-[2px] border border-soft-hairline border-t-[2px] border-t-inari-vermillion/70 bg-warm-paper-raised sm:h-[4.5rem] sm:w-[6.5rem]" />
    </div>
  )
}

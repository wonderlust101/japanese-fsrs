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
 * V2 — Solo Card.
 *
 * One large centered card, alone on the page. The quietest possible Profile.
 * Inside the card, the facts stack vertically (rather than flowing inline)
 * so the larger generosity of the surrounding negative space is matched by
 * generosity of the interior. The kitsune seal sits in the lower-right
 * corner as a quiet stamp.
 */
export function DirectionSolo({
  profile, displayName, joinedAt,
}: ProfileDirectionProps): React.JSX.Element {
  const targetLabel = formatJlptLevel(profile.jlptTarget)
  const joinedLabel = formatJoinedMonth(joinedAt)

  return (
    <main className="mx-auto w-full max-w-[68rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
      <ProfileCard
        tone="foreground"
        ariaLabelledBy="profile-solo-name"
        className="relative mx-auto max-w-[32rem] px-8 py-12 sm:px-12 sm:py-16"
      >
        <IdentityHeading id="profile-solo-name" name={displayName} size="lg" />
        <div className="mt-8">
          <FactLine targetLabel={targetLabel} joinedLabel={joinedLabel} stacked />
        </div>
        <KitsuneSeal className="absolute right-6 bottom-5 sm:right-8 sm:bottom-7" size="lg" />
      </ProfileCard>
    </main>
  )
}

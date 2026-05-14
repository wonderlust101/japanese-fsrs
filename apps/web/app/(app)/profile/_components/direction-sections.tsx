'use client'

import { SectionCard } from '@/components/ui/SectionCard'

import { BasicInfoSection, type BasicInfoVariant } from './section-basicinfo'
import { CadenceSection,   type CadenceVariant }   from './section-cadence'
import { CurrentlySection, type CurrentlyVariant } from './section-currently'
import { MastheadSection,  type MastheadVariant }  from './section-masthead'
import { ShelfSection,     type ShelfVariant }     from './section-shelf'
import { buildProfileStubData } from './profile-stub-data'
import type { ProfileDirectionProps } from './profile-shared'

export interface SectionVariants {
  masthead:  MastheadVariant
  basicInfo: BasicInfoVariant
  cadence:   CadenceVariant
  currently: CurrentlyVariant
  shelf:     ShelfVariant
}

interface DirectionSectionsProps extends ProfileDirectionProps {
  variants: SectionVariants
}

/**
 * The canonical sectioned profile composition. Four modules — Basic
 * Info, Practice, Currently, Shared decks — each wrapped in the shared
 * SectionCard primitive, plus the bare masthead at the top. Retention
 * and Recent Reviews were retired by the owner (the latter for being
 * too personal on a public-facing surface); forum activity is a
 * deferred slot.
 *
 * The masthead stays outside any card on purpose: it's an identity
 * moment, not a module, and the dashboard's own hero is also unwrapped.
 *
 * The Currently section receives inCard=true so Cu1/Cu2/Cu3 strip
 * their internal CardShell — SectionCard already provides the outer
 * chrome, and DESIGN.md bans nested cards.
 */
export function DirectionSections({
  variants,
  profile,
  displayName,
  joinedAt,
}: DirectionSectionsProps): React.JSX.Element {
  const stub = buildProfileStubData(displayName)
  const practicedDays = stub.cadence.filter((d) => d.intensity > 0).length

  return (
    <main className="mx-auto w-full max-w-[68rem] px-4 pb-24 pt-10 sm:px-6 sm:pt-12 lg:px-10 lg:pt-14">
      {/* Masthead — bare; identity moment, not a module. */}
      <MastheadSection
        variant={variants.masthead}
        displayName={displayName}
        jlptTarget={profile.jlptTarget}
        joinedAt={joinedAt}
        stub={stub}
      />

      <div className="mt-10 grid gap-5 sm:mt-12 sm:gap-6">
        <SectionCard
          id="profile-basic"
          kanji="紹"
          label="Basic info"
          description="Native language, target, and study context."
          variant="compact"
        >
          <BasicInfoSection
            variant={variants.basicInfo}
            jlptTarget={profile.jlptTarget}
            joinedAt={joinedAt}
            stub={stub}
          />
        </SectionCard>

        <SectionCard
          id="profile-practice"
          kanji="暦"
          label="Practice"
          description="Daily study activity over the past 12 months."
          variant="compact"
        >
          <CadenceSection variant={variants.cadence} cadence={stub.cadence} />
        </SectionCard>

        <SectionCard
          id="profile-currently"
          kanji="今"
          label="Now studying"
          description="The deck you're working through and the word in front of you."
          variant="compact"
        >
          <CurrentlySection variant={variants.currently} currently={stub.currently} inCard />
        </SectionCard>

        <SectionCard
          id="profile-shelf"
          kanji="棚"
          label="Shared decks"
          description="Decks you've made public for other learners."
          count={stub.shelf.length}
          variant="compact"
        >
          <ShelfSection variant={variants.shelf} shelf={stub.shelf} />
        </SectionCard>
      </div>
    </main>
  )
}

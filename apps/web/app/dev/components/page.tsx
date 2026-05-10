import type { Metadata } from 'next'
import { ButtonsSection }          from './sections/ButtonsSection'
import { CardsSection }            from './sections/CardsSection'
import { DialogSection }           from './sections/DialogSection'
import { IconsSection }            from './sections/IconsSection'
import { InputsSection }           from './sections/InputsSection'
import { PillsSection }            from './sections/PillsSection'
import { ReviewComponentsSection } from './sections/ReviewComponentsSection'
import { SrsComponentsSection }    from './sections/SrsComponentsSection'
import { TextSection }             from './sections/TextSection'
import { TokensSection }           from './sections/TokensSection'
import { SideNav }                 from './_components/SideNav'

export const metadata: Metadata = {
  title: 'Component showcase',
}

const SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'tokens',   label: 'Tokens'   },
  { id: 'buttons',  label: 'Buttons'  },
  { id: 'inputs',   label: 'Inputs'   },
  { id: 'cards',    label: 'Cards'    },
  { id: 'pills',    label: 'Pills'    },
  { id: 'dialog',   label: 'Dialog'   },
  { id: 'text',     label: 'Text'     },
  { id: 'icons',    label: 'Icons'    },
  { id: 'review',   label: 'Review'   },
  { id: 'srs',      label: 'SRS'      },
]

export default function ComponentShowcasePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 lg:py-14">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-2">Dev only</p>
        <h1 className="font-display text-3xl text-sumi-ink mb-2">Component showcase</h1>
        <p className="text-sm text-faded-sumi max-w-prose">
          Every reusable atom in the Tomo design system, rendered in isolation.
          Source of truth for variants, sizes, and states. Hidden in production.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-10">
        <SideNav sections={SECTIONS} />

        <main className="space-y-16 min-w-0">
          <TokensSection />
          <ButtonsSection />
          <InputsSection />
          <CardsSection />
          <PillsSection />
          <DialogSection />
          <TextSection />
          <IconsSection />
          <ReviewComponentsSection />
          <SrsComponentsSection />
        </main>
      </div>
    </div>
  )
}

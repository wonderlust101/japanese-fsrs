'use client'

import { useState } from 'react'
import { CapsLockHint }           from '@/components/ui/CapsLockHint'
import { Input }                   from '@/components/ui/Input'
import { OTPInput }                from '@/components/ui/OtpInput'
import { Select }                  from '@/components/ui/Select'
import { ShowcaseGrid, ShowcaseItem } from '../_components/ShowcaseItem'
import { ShowcaseSection }            from '../_components/ShowcaseSection'

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語'   },
  { value: 'es', label: 'Español'  },
]

export function InputsSection(): React.JSX.Element {
  const [otp, setOtp] = useState('')

  return (
    <ShowcaseSection
      id="inputs"
      title="Inputs"
      description="Form primitives: Input, Select, OTPInput, CapsLockHint."
    >
      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Input</h3>
        <ShowcaseGrid minColumnWidth={280}>
          <ShowcaseItem label="Default" caption='size="md"' fill>
            <Input label="Email" placeholder="you@example.com" />
          </ShowcaseItem>
          <ShowcaseItem label="With hint" caption="hint" fill>
            <Input label="Password" type="password" hint="At least 12 characters." />
          </ShowcaseItem>
          <ShowcaseItem label="With error" caption='error="..."' fill>
            <Input label="Email" defaultValue="not-an-email" error="That's not a valid email." />
          </ShowcaseItem>
          <ShowcaseItem label="Japanese (kana)" caption='script="kana"' fill>
            <Input label="読み" script="kana" placeholder="たべる" />
          </ShowcaseItem>
          <ShowcaseItem label="Small" caption='size="sm"' fill>
            <Input label="Search" size="sm" placeholder="Search decks" />
          </ShowcaseItem>
          <ShowcaseItem label="Large" caption='size="lg"' fill>
            <Input label="Name" size="lg" placeholder="Your name" />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">Select</h3>
        <ShowcaseGrid minColumnWidth={280}>
          <ShowcaseItem label="Default" caption="options=[...]" fill>
            <Select label="Language" options={LANG_OPTIONS} />
          </ShowcaseItem>
          <ShowcaseItem label="With error" caption='error="..."' fill>
            <Select label="Language" options={LANG_OPTIONS} error="Pick one." />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-[0.18em] text-faded-sumi mb-3">OTP + CapsLockHint</h3>
        <ShowcaseGrid minColumnWidth={320}>
          <ShowcaseItem
            label="OTPInput"
            caption={`onComplete=(otp)=>... · current="${otp}"`}
            fill
          >
            <OTPInput onComplete={setOtp} />
          </ShowcaseItem>
          <ShowcaseItem label="CapsLockHint" caption="static (parent controls visibility)" fill>
            <CapsLockHint />
          </ShowcaseItem>
        </ShowcaseGrid>
      </div>
    </ShowcaseSection>
  )
}

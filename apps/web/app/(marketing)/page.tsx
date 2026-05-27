import type { Metadata } from 'next'

import { JsonLd, organizationSchema, webApplicationSchema } from '@/components/seo/JsonLd'
import { env } from '@/lib/env'

import { LandingExperience } from './_components/landing-experience'

const SITE_URL = env.NEXT_PUBLIC_SITE_URL
const PAGE_DESCRIPTION =
  'Tomo is a calm spaced-repetition app for Japanese learners: FSRS scheduling that times each card to your memory, cards built for you with example sentences and mnemonics, and a teacher’s eye for your weak spots. JLPT N5–N1 decks included.'

// Homepage. Inherits the root `title.default` ('Tomo · Japanese spaced
// repetition') and the root `openGraph` block (image, siteName, type, url '/')
// wholesale — we deliberately do NOT redefine `openGraph` here, because Next
// replaces rather than deep-merges it, which would drop the inherited og:image.
// We only override the meta description and set the canonical.
//
// This file stays a server component so the metadata export and JSON-LD payload
// render server-side for SEO; the scroll-choreographed, GSAP-driven body lives
// in the client `<LandingExperience>` child.
export const metadata: Metadata = {
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/' },
}

export default function LandingPage(): React.JSX.Element {
  return (
    <>
      <JsonLd schema={[organizationSchema(SITE_URL), webApplicationSchema(SITE_URL, PAGE_DESCRIPTION)]} />
      <LandingExperience />
    </>
  )
}

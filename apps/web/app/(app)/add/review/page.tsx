import type { Metadata } from 'next'

import { TopBar } from '../../_components/top-bar'

import { GeneratedReviewClient } from './_components/generated-review-client'

export const metadata: Metadata = { title: 'Add Japanese — review' }

export default function GeneratedCardReviewPage(): React.JSX.Element {
  return (
    <>
      <TopBar desktopHidden />
      <div className="flex min-h-full flex-col pb-40 lg:pb-32">
        <GeneratedReviewClient />
      </div>
    </>
  )
}

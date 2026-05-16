import type { Metadata } from 'next'

import { ForecastView } from './_components/ForecastView'

export const metadata: Metadata = { title: 'Insights — Forecast' }

export default function InsightsForecastPage(): React.JSX.Element {
  return <ForecastView />
}

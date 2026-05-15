const EXACT_COUNT_FORMAT = new Intl.NumberFormat('en-US')
const COMPACT_COUNT_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
})

export function safeNonNegativeInteger(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0
}

export function clampPercent(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 0
}

export function clampRatio(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0
}

export function safePercentagePoint(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0
}

export function formatExactCount(value: number | null | undefined): string {
  return EXACT_COUNT_FORMAT.format(safeNonNegativeInteger(value))
}

export function formatCompactCount(value: number | null | undefined): string {
  return COMPACT_COUNT_FORMAT.format(safeNonNegativeInteger(value))
}

'use client'

import {
  CardHeader,
  CHART_MODULE_CHROME,
  LIST_MODULE_CHROME,
} from '@/app/(app)/today/_components/section-primitives'

interface SectionCardProps {
  /**
   * Section id. When provided, lands on the outer <section> element
   * (useful for scroll anchors and IntersectionObserver targets like the
   * settings rail), and a derived `${id}-heading` id is placed on the
   * inner <h2> so aria-labelledby resolves correctly. Heading-id
   * derivation is automatic; consumers only manage the section id.
   */
  id?: string
  /** Single kanji or 2-char compound — the vermillion ornament. */
  kanji:         string
  /** Small-caps mono label rendered after the kanji. */
  label:         string
  /** Optional count rendered after the label as " · {n}". */
  count?:        number
  /** Optional context line under the label. */
  description?:  string
  /** Optional right-aligned slot in the header. */
  rightContent?: React.ReactNode
  /**
   * Header rhythm. Mirrors CardHeader's variant axis so the SectionCard
   * stays a transparent ergonomic wrapper rather than re-shaping anything.
   */
  variant?:      'default' | 'compact' | 'chart'
  /**
   * Outer chrome flavour. `'list'` (default) uses LIST_MODULE_CHROME —
   * the canonical card surface (h-full, responsive padding). `'chart'`
   * uses CHART_MODULE_CHROME — `relative overflow-hidden` with slightly
   * tighter horizontal padding at the base breakpoint, for chart
   * modules whose content needs the overflow clip.
   */
  chrome?:       'list' | 'chart'
  /** Mirrors the aria-busy attribute on the outer <section>. Use during
   *  loading states; consumers shouldn't set it permanently. */
  ariaBusy?:     boolean
  /** Additional classes appended to the outer card chrome. */
  className?:    string
  children:      React.ReactNode
}

/**
 * The dashboard's section-card pattern, extracted into a single reusable
 * primitive. Combines LIST_MODULE_CHROME / CHART_MODULE_CHROME (warm-paper
 * card + soft-hairline border + responsive padding) with CardHeader
 * (vermillion kanji at text-xl + small-caps mono label + optional
 * count/description/action + hairline rule beneath).
 *
 * Use this anywhere you'd otherwise write the longer pattern by hand:
 *
 *   <section aria-labelledby={id} className={LIST_MODULE_CHROME}>
 *     <CardHeader id={id} kanji={...} label={...} ... />
 *     ...children...
 *   </section>
 *
 * Lives in components/ui (not in any feature's _components folder) so
 * dashboard, profile, settings, and any future surface can adopt the
 * same module-card chrome without cross-feature imports.
 *
 * Optional props use conditional spread to comply with TypeScript's
 * exactOptionalPropertyTypes mode — passing `undefined` to a `?:` prop
 * would otherwise type-error.
 */
export function SectionCard({
  id, kanji, label, count, description, rightContent, variant,
  chrome = 'list', ariaBusy, className = '', children,
}: SectionCardProps): React.JSX.Element {
  const baseChrome = chrome === 'chart' ? CHART_MODULE_CHROME : LIST_MODULE_CHROME
  const outerClass = className.length > 0 ? `${baseChrome} ${className}` : baseChrome

  const headingId = id !== undefined ? `${id}-heading` : undefined

  return (
    <section
      {...(id        !== undefined && { id })}
      {...(headingId !== undefined && { 'aria-labelledby': headingId })}
      {...(ariaBusy  === true      && { 'aria-busy': true })}
      className={outerClass}
    >
      <CardHeader
        kanji={kanji}
        label={label}
        {...(headingId    !== undefined && { id: headingId })}
        {...(count        !== undefined && { count })}
        {...(description  !== undefined && { description })}
        {...(rightContent !== undefined && { rightContent })}
        {...(variant      !== undefined && { variant })}
      />
      {children}
    </section>
  )
}

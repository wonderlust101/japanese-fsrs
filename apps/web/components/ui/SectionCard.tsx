'use client'

import {
  CardHeader,
  CHART_MODULE_CHROME,
  LIST_MODULE_CHROME,
} from '@/app/(app)/today/_components/section-primitives'

type StripeTone = 'brand' | 'aizome' | 'error' | 'none'

const STRIPE_TONE_VAR: Record<Exclude<StripeTone, 'none'>, string> = {
  brand:  'var(--color-inari-vermillion)',
  aizome: 'var(--color-aizome-indigo)',
  error:  'var(--color-error)',
}

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
   * uses CHART_MODULE_CHROME — slightly tighter horizontal padding at the
   * base breakpoint, for chart modules whose content needs to clip to the
   * rounded edges.
   */
  chrome?:       'list' | 'chart'
  /**
   * Top-edge identity stripe. Defaults to `'brand'` (Inari Vermillion) —
   * every SectionCard surface carries the brand stripe by default. Use
   * `'aizome'` or `'error'` for status-coded modules, or `'none'` to opt
   * out entirely. The stripe is always 2px (the canonical rule weight) —
   * the lighter hairline isn't appropriate for the SectionCard surface.
   */
  stripeTone?:   StripeTone
  /**
   * Kanji ornament color. Defaults to `'brand'`. Set to `'aizome'` on
   * surfaces that pair a non-brand stripe so the kanji follows the stripe.
   */
  kanjiTone?:    'brand' | 'aizome' | 'error'
  /**
   * Quiet inline flag rendered after the label (with middot separator) in
   * aizome-indigo. Used for trust signals like "Showing the last saved
   * queue" when data is stale. Mirrors today-hero's HeroKicker idiom.
   */
  flag?:         string
  /**
   * When true, the CardHeader is not rendered. Only the stripe + body +
   * (optionally) a floated `rightContent` slot remain. Used by surfaces that
   * provide their own title chrome elsewhere (Review Session v4: the session
   * top bar carries the kicker; the card surface only needs the stripe and a
   * card-scoped overflow menu). `kanji` and `label` are still required by
   * the type so calls remain explicit; pass empty strings when omitted.
   */
  omitTitle?:    boolean
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
 * Every SectionCard surface carries a 2px Inari Vermillion top-edge stripe
 * by default — the identity device that signals "this is a Tomo module."
 * Override via `stripeTone` ('aizome' / 'error' / 'none') when needed.
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
  chrome = 'list', stripeTone = 'brand', kanjiTone, flag, omitTitle = false, ariaBusy, className = '', children,
}: SectionCardProps): React.JSX.Element {
  const baseChrome = chrome === 'chart' ? CHART_MODULE_CHROME : LIST_MODULE_CHROME
  // Inject `relative overflow-hidden` so the stripe positions to the card's
  // top edge and clips cleanly to the 2px corners. CHART_MODULE_CHROME
  // already includes both (harmless duplication); LIST_MODULE_CHROME does
  // not, so the injection is what makes the stripe work on list-flavored
  // SectionCards.
  const stripeShellClass = 'relative overflow-hidden'
  const outerClass = [stripeShellClass, baseChrome, className].filter((c) => c.length > 0).join(' ')

  const headingId = id !== undefined ? `${id}-heading` : undefined
  const stripeColor = stripeTone === 'none' ? undefined : STRIPE_TONE_VAR[stripeTone]

  return (
    <section
      {...(id        !== undefined && { id })}
      {...(headingId !== undefined && { 'aria-labelledby': headingId })}
      {...(ariaBusy  === true      && { 'aria-busy': true })}
      className={outerClass}
    >
      {stripeColor !== undefined && (
        <span
          aria-hidden="true"
          // z-[1] is enough to stack above the card's own children (which
          // default to z-auto); deliberately keeps the stripe below
          // page-level sticky chrome (TopBar, section tabs) which sit at
          // z-10+ so the stripe never paints over them as the card
          // scrolls past.
          className="absolute inset-x-0 top-0 z-[1] h-[2px]"
          style={{ backgroundColor: stripeColor }}
        />
      )}
      {omitTitle ? (
        rightContent !== undefined && (
          <div className="absolute right-3 top-3 z-20 font-mono text-xs text-faded-sumi">
            {rightContent}
          </div>
        )
      ) : (
        <CardHeader
          kanji={kanji}
          label={label}
          {...(headingId    !== undefined && { id: headingId })}
          {...(count        !== undefined && { count })}
          {...(description  !== undefined && { description })}
          {...(rightContent !== undefined && { rightContent })}
          {...(variant      !== undefined && { variant })}
          {...(kanjiTone    !== undefined && { kanjiTone })}
          {...(flag         !== undefined && { flag })}
        />
      )}
      {children}
    </section>
  )
}

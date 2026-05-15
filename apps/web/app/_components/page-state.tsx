'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { Logo } from '@/components/ui/Logo'
import { EASE_OUT_EXPO } from '@/lib/motion'

/**
 * Shared composition for surfaces that signal "no content lives here" (not-
 * found) or "something interrupted practice" (error). Both surfaces share the
 * same card-on-cool-paper anatomy from DESIGN.md (the card-stack identity):
 * 2px Inari Vermillion top stripe, 1px Soft Hairline border, Warm Paper Raised
 * fill, no resting shadow. The kitsune lives in the identity strip at the top;
 * the card-stack hero sits below the kicker. Composition reads as a single
 * deck card the user is looking at, not a "page that broke."
 *
 * Five composable pieces, used by the five entry points
 * (app/not-found.tsx, app/error.tsx, app/global-error.tsx and the
 * (app)-segment variants). Each piece mirrors a part of the dashboard hero
 * (`HeroKicker`, `HeroPrimaryAction`) so the visual language stays continuous
 * across surfaces.
 */

export type StateTone = 'default' | 'error'

interface PageStateFrameProps {
  /**
   * `fullbleed` paints the cool-paper page background and centers the card.
   * Used by root-level surfaces that may render without an app shell (404 on
   * an unauthenticated route, the root error boundary, the global last-resort
   * boundary).
   *
   * `inshell` skips the page-level background because the (app) layout
   * already paints `bg-cool-paper-base`. The composition sits inside the
   * scrollable main area so the sidebar and top-bar remain.
   */
  variant: 'fullbleed' | 'inshell'
  children: React.ReactNode
}

/**
 * Outer frame. Owns the page-level background (when full-bleed) and the
 * vertical centering. Inner card composition is identical between variants.
 */
export function PageStateFrame({ variant, children }: PageStateFrameProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  const card = (
    <motion.section
      role="region"
      aria-labelledby="page-state-headline"
      initial={reducedMotion === true ? false : { opacity: 0, y: 8 }}
      animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion === true ? 0 : 0.32,
        ease:     EASE_OUT_EXPO,
      }}
      className={[
        'relative w-full max-w-[min(640px,92vw)] overflow-hidden rounded-[2px]',
        'border border-soft-hairline bg-warm-paper-raised',
        'px-6 py-8 sm:px-10 sm:py-12',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-[2px] bg-inari-vermillion"
      />
      <div className="relative z-0 flex flex-col items-center text-center">
        {children}
      </div>
    </motion.section>
  )

  if (variant === 'inshell') {
    return (
      <div className="flex min-h-full w-full items-start justify-center px-4 py-12 sm:py-20">
        {card}
      </div>
    )
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-cool-paper-base px-4 py-12 sm:py-16">
      {card}
    </main>
  )
}

/**
 * Identity strip at the very top of the card. The Logo component already
 * draws the kitsune mark + TOMO wordmark; the underline strip beneath the
 * wordmark mirrors the sidebar header construction so the surface is
 * recognizably Tomo before the visitor reads anything.
 *
 * The kitsune SVG is the canonical brand mark and stays Inari Vermillion
 * regardless of tone (PRODUCT.md: never recolored for decoration). The
 * underline IS recolorable — error tone swaps it to the error red so the
 * brand still announces itself but the surface reads as an error moment
 * before the eye reaches the kicker.
 */
export function IdentityStrip({ tone = 'default' }: { tone?: StateTone }): React.JSX.Element {
  const isError = tone === 'error'

  return (
    <div className="relative inline-flex items-center" aria-label="Tomo">
      <Logo size={56} wordmarkSize="lg" priority />
      <span
        aria-hidden="true"
        className={[
          'absolute h-px',
          isError ? 'bg-error' : 'bg-inari-vermillion',
        ].join(' ')}
        style={{ left: '3.75rem', right: 0, bottom: '0.55rem' }}
      />
    </div>
  )
}

/**
 * Kanji + uppercase mono label, separated from the visual below by a 1px
 * hairline. Mirrors the dashboard hero's `HeroKicker` exactly so the page
 * reads as Tomo's typographic register, not a generic error page.
 */
export function HeroKicker({
  kanji,
  label,
  tone = 'default',
}: {
  kanji: string
  label: string
  tone?: StateTone
}): React.JSX.Element {
  const isError = tone === 'error'

  return (
    <header className="mt-6 w-full">
      <p className="flex items-baseline justify-center gap-3.5">
        <span
          lang="ja"
          aria-hidden="true"
          className={[
            'select-none font-display text-3xl leading-none',
            isError ? 'text-error' : 'text-inari-vermillion',
          ].join(' ')}
        >
          {kanji}
        </span>
        <span
          className={[
            'font-mono text-sm font-medium uppercase tracking-[0.08em]',
            isError ? 'text-error-deep/85' : 'text-sumi-ink/80',
          ].join(' ')}
        >
          {label}
        </span>
      </p>
      <hr
        aria-hidden="true"
        className={[
          'mx-auto mt-4 w-full border-0 border-t',
          isError ? 'border-error/25' : 'border-soft-hairline',
        ].join(' ')}
      />
    </header>
  )
}

/**
 * Slot for the card-stack visual. Held to a fixed min-height so the page
 * doesn't reflow when the visual swaps. Honors reduced-motion via parent.
 */
export function VisualSlot({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="mt-8 flex w-full items-center justify-center"
    >
      {children}
    </div>
  )
}

/**
 * Single dust-jacket deck card sitting on the desk with the dashed-hairline
 * empty-state outline pattern from the dashboard hero's empty fallback.
 * Carries a kanji on its face at low opacity, so the card itself echoes
 * the typographic moment above it, plus a small mono label that names
 * the kind of moment.
 *
 * Shared by not-found surfaces (default tone: soft-hairline border, sumi
 * kanji, faded-sumi label) and error surfaces (error tone: dashed error
 * border, error-deep kanji at low opacity, error-deep label). Same calm
 * composition, two semantic color registers — the visual SHAPE says
 * "nothing to do here," the visual COLOR says whether that's a quiet
 * empty state or an interrupted one.
 */
export function EmptyPathVisual({
  kanji = '路',
  label = 'Empty path',
  tone  = 'default',
}: {
  kanji?: string
  label?: string
  tone?:  StateTone
}): React.JSX.Element {
  const isError = tone === 'error'

  return (
    <div className="relative h-[180px] w-full max-w-[280px]">
      <div
        className={[
          'absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-1.2deg]',
          'mx-auto w-[88%] rounded-[2px] px-5 py-6',
          'border border-dashed',
          isError
            ? 'border-error/45 bg-error-tint/25'
            : 'border-soft-hairline bg-warm-paper-raised/70',
        ].join(' ')}
      >
        <p
          lang="ja"
          aria-hidden="true"
          className={[
            'text-center font-display text-5xl leading-none',
            isError ? 'text-error-deep/25' : 'text-sumi-ink/15',
          ].join(' ')}
        >
          {kanji}
        </p>
        <p
          className={[
            'mt-4 text-center font-mono text-[0.625rem] uppercase tracking-[0.18em]',
            isError ? 'text-error-deep' : 'text-faded-sumi',
          ].join(' ')}
        >
          {label}
        </p>
      </div>
    </div>
  )
}

/**
 * Page headline (h1). One per page. Bricolage Grotesque, scale tuned to
 * read as a calm statement rather than a shout. Error tone is retained as
 * an option for any future surface that wants the deeper red, though all
 * current page-state surfaces use the default (sumi-ink) register.
 */
export function PageHeadline({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?:    StateTone
}): React.JSX.Element {
  return (
    <h1
      id="page-state-headline"
      className={[
        'mt-7 font-display text-[1.65rem] sm:text-[2.05rem] leading-[1.1]',
        tone === 'error' ? 'text-error-deep' : 'text-sumi-ink',
      ].join(' ')}
    >
      {children}
    </h1>
  )
}

/**
 * Body line under the headline. Holds the reassurance ("Nothing has been
 * lost.", "Nothing on the schedule has changed.") so the calm carries the
 * page even when the kicker is in error tone.
 */
export function PageBody({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mt-3 max-w-[44ch] text-base leading-relaxed text-faded-sumi">
      {children}
    </p>
  )
}

interface PrimaryActionProps {
  children: React.ReactNode
  tone?:    StateTone
  href?:    string
  onClick?: () => void
  type?:    'button' | 'submit'
}

/**
 * Primary CTA, matching the dashboard hero's `HeroPrimaryAction` exactly.
 * Vermillion fill by default; error tone swaps to the danger fill so the
 * action visually owns the failure surface. Accepts either an `href`
 * (renders Next/Link) or `onClick` (renders a button for the soft-retry
 * call to `reset()` on error.tsx).
 */
export function PrimaryAction({
  children,
  tone = 'default',
  href,
  onClick,
  type = 'button',
}: PrimaryActionProps): React.JSX.Element {
  const isError = tone === 'error'
  // Color order matches DESIGN.md §Components → Buttons: brand red at rest,
  // deep variant on hover. Same direction (lighter → darker on interaction)
  // for both tones, so the button reads consistently regardless of register.
  const className = [
    'inline-flex min-h-12 min-w-[240px] max-w-full items-center justify-center gap-2.5',
    'rounded-[2px] px-8 py-3 text-base font-semibold',
    'today-motion-transform',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2',
    isError
      ? 'bg-error text-warm-paper-raised hover:-translate-y-0.5 hover:bg-error-deep active:translate-y-0 focus-visible:outline-error-deep'
      : 'bg-inari-vermillion text-warm-paper-raised hover:-translate-y-0.5 hover:bg-inari-vermillion-deep active:translate-y-0 focus-visible:outline-sumi-ink',
  ].join(' ')

  const inner = (
    <>
      {children}
      <ArrowGlyph direction="right" />
    </>
  )

  if (href !== undefined) {
    return (
      <div className="mt-8">
        <Link href={href} className={className}>
          {inner}
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <button type={type} onClick={onClick} className={className}>
        {inner}
      </button>
    </div>
  )
}

interface InlinePathsRowProps {
  children: React.ReactNode
}

/**
 * Row of small ghost-style secondary paths. Wraps on narrow viewports.
 * Used for the 404's "Browse decks · Reviews · Settings" trio and the
 * 500's "Back to dashboard · Report this" pair.
 */
export function InlinePathsRow({ children }: InlinePathsRowProps): React.JSX.Element {
  return (
    <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-faded-sumi">
      {children}
    </ul>
  )
}

interface InlinePathProps {
  children: React.ReactNode
  href?:    string
  onClick?: () => void
}

/**
 * Single secondary path. Renders as a Link when given an href; renders as
 * a button when given onClick (the Report-this case copies a payload to
 * the clipboard rather than navigating).
 *
 * The arrow glyph trails the label (right side) so the inline-paths row
 * stays consistent with the primary CTA and the FullReloadHint — every
 * navigable affordance on the page reads label-first, arrow-trailing.
 */
export function InlinePath({ children, href, onClick }: InlinePathProps): React.JSX.Element {
  const className = [
    'inline-flex items-center gap-1.5 rounded-[2px] px-1 py-1',
    'text-sm text-faded-sumi transition-colors',
    'hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
  ].join(' ')

  const inner = (
    <>
      <span>{children}</span>
      <ArrowGlyph direction="right" className="opacity-60" />
    </>
  )

  return (
    <li>
      {href !== undefined ? (
        <Link href={href} className={className}>{inner}</Link>
      ) : (
        <button type="button" onClick={onClick} className={className}>{inner}</button>
      )}
    </li>
  )
}

/**
 * Quiet "Full reload →" link that the error page shows once the user has
 * tried `reset()` twice without success. Lives below the primary row so
 * it's discoverable but doesn't compete with the soft-retry default.
 */
export function FullReloadHint({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <p className="mt-3 text-sm text-faded-sumi">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-[2px] px-1 py-1 text-faded-sumi underline-offset-4 transition-colors hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
      >
        Still stuck? Full reload
        <ArrowGlyph direction="right" className="opacity-60" />
      </button>
    </p>
  )
}

/**
 * Shared "copy this to clipboard" helper. Returns the click handler plus
 * the transient "Copied" state used by the dev panel and Report-this
 * button. Lives here (not in lib/) because no other surface needs it and
 * a one-file hook is easier to reason about than a shared util.
 *
 * Browser clipboard write is `async`; we fire-and-display "Copied" only
 * on success. If the API rejects (older browsers, insecure context), the
 * affordance silently no-ops rather than throwing a toast at the user —
 * the dev panel still shows the text below.
 */
export function useCopyConfirmation(): {
  copied: boolean
  copy:   (text: string) => void
} {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(t)
  }, [copied])

  function copy(text: string): void {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      return
    }
    void navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => { /* clipboard write blocked; surface stays calm */ },
    )
  }

  return { copied, copy }
}

interface DevPanelProps {
  /**
   * In production this component renders nothing. The check happens inside
   * the component so callers can keep markup flat; tree-shaking will drop
   * the body for prod builds when NODE_ENV is statically known.
   *
   * The `| undefined` widening on each field matches the project's pattern
   * (see DueQueue in today-hero.tsx). With `exactOptionalPropertyTypes`
   * on, callers can pass `digest: error.digest` directly even when the
   * underlying `error.digest` is itself `string | undefined`.
   */
  error?:    {
    name?:    string | undefined
    message?: string | undefined
    digest?:  string | undefined
    stack?:   string | undefined
  } | undefined
  pathname?: string | undefined
  /**
   * Optional referrer string (only meaningful on 404, where the user's
   * previous page is informative). Omitted entirely from the dev panel
   * if not provided.
   */
  referrer?: string | undefined
}

/**
 * Development-only structured error panel modeled after Next.js's dev
 * overlay: labeled fields (Name, Message, Digest, Route, Time, Browser)
 * and the full stack trace, all in JetBrains Mono. Two copy affordances —
 * "Copy all" copies a structured Markdown block (paste-friendly into
 * GitHub issues, Discord, email) and "Copy stack" copies only the stack
 * trace. Both buttons morph to "✓ Copied" for 1500ms after click.
 *
 * Expanded by default so the developer sees the error without an extra
 * click. The chevron at top-right collapses to a one-line summary.
 *
 * In production this component renders `null` and disappears from the
 * output. The "Report this" button (defined separately) covers the
 * production reporting channel.
 */
export function DevPanel({ error, pathname, referrer }: DevPanelProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(true)
  const { copied: copiedAll,   copy: copyAll }   = useCopyConfirmation()
  const { copied: copiedStack, copy: copyStack } = useCopyConfirmation()

  // The check is intentionally inside render so the component is safe to
  // import unconditionally. Webpack drops the body for prod bundles.
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const time    = new Date().toISOString()
  const browser = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'

  const fields: { label: string; value: string }[] = [
    ...(error?.name        !== undefined ? [{ label: 'Name',    value: error.name    }] : []),
    ...(error?.message     !== undefined ? [{ label: 'Message', value: error.message }] : []),
    ...(error?.digest      !== undefined ? [{ label: 'Digest',  value: error.digest  }] : []),
    ...(pathname           !== undefined ? [{ label: 'Route',   value: pathname      }] : []),
    ...(referrer           !== undefined ? [{ label: 'Referrer', value: referrer     }] : []),
    { label: 'Time',    value: time    },
    { label: 'Browser', value: browser },
  ]

  const markdownPayload = buildMarkdownReport({
    name:     error?.name,
    message:  error?.message,
    digest:   error?.digest,
    stack:    error?.stack,
    pathname,
    referrer,
    time,
    browser,
  })

  return (
    <section
      aria-label="Developer information"
      className={[
        'mt-10 w-full rounded-[2px] border border-soft-hairline bg-cream-inset/60',
        'text-left',
      ].join(' ')}
    >
      <header className="flex items-center justify-between gap-3 border-b border-soft-hairline px-4 py-2.5">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
          Development info
        </p>
        <div className="flex items-center gap-1.5">
          <CopyButton
            onClick={() => copyAll(markdownPayload)}
            copied={copiedAll}
            label="Copy all"
          />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse developer info' : 'Expand developer info'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-faded-sumi transition-colors hover:bg-warm-paper-raised hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              aria-hidden="true"
              className={['transition-transform', expanded ? '' : '-rotate-90'].join(' ')}
            >
              <path d="M2 4 L 6 8 L 10 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        </div>
      </header>

      {expanded && (
        <div className="px-4 py-3">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2 font-mono text-xs leading-relaxed">
            {fields.map((f) => (
              <DevField key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>

          {error?.stack !== undefined && (
            <div className="mt-4 border-t border-soft-hairline pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
                  Stack
                </p>
                <CopyButton
                  onClick={() => copyStack(error.stack ?? '')}
                  copied={copiedStack}
                  label="Copy stack"
                />
              </div>
              <pre
                className={[
                  'mt-2 max-h-80 overflow-auto rounded-[2px] bg-warm-paper-raised',
                  'p-3 font-mono text-[0.6875rem] leading-relaxed text-sumi-ink',
                  'whitespace-pre',
                ].join(' ')}
              >
                {error.stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function DevField({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <>
      <dt className="text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sumi-ink">
        {value}
      </dd>
    </>
  )
}

interface CopyButtonProps {
  onClick: () => void
  copied:  boolean
  label:   string
}

function CopyButton({ onClick, copied, label }: CopyButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={[
        'inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1',
        'font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors',
        copied
          ? 'border-deck-n5-mark/30 bg-deck-n5-wash text-deck-n5-mark'
          : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
      ].join(' ')}
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 5 L 4.2 7 L 8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Copied
        </>
      ) : (
        label
      )}
    </button>
  )
}

interface ReportPayload {
  name?:     string | undefined
  message?:  string | undefined
  digest?:   string | undefined
  stack?:    string | undefined
  pathname?: string | undefined
  referrer?: string | undefined
  time?:     string | undefined
  browser?:  string | undefined
}

/**
 * Builds the paste-friendly Markdown block that the dev panel "Copy all"
 * button and the production "Report this" button both produce. Format
 * mirrors a GitHub issue template: front-matter style fields, then a
 * fenced code block for the stack when present.
 *
 * In production callers omit `stack` (server-side only, unsafe to surface
 * to clients); the function gracefully omits the code block in that case.
 */
export function buildMarkdownReport(p: ReportPayload): string {
  const lines: string[] = ['**Tomo error**', '']
  if (p.digest   !== undefined) lines.push(`- Digest: \`${p.digest}\``)
  if (p.pathname !== undefined) lines.push(`- Route: \`${p.pathname}\``)
  if (p.referrer !== undefined) lines.push(`- Referrer: \`${p.referrer}\``)
  if (p.time     !== undefined) lines.push(`- Time: ${p.time}`)
  if (p.browser  !== undefined) lines.push(`- Browser: ${p.browser}`)
  if (p.name     !== undefined) lines.push(`- Name: \`${p.name}\``)
  if (p.message  !== undefined) lines.push(`- Message: ${p.message}`)
  if (p.stack    !== undefined) {
    lines.push('', '```', p.stack, '```')
  }
  return lines.join('\n')
}

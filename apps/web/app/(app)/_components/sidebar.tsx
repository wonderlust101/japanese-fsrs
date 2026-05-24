'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { IconChevronLeft, IconChevronRight } from '@/components/icons/chrome-marks'
import { Logo }                  from '@/components/ui/Logo'
import { useDueCards }           from '@/lib/api/reviews'
import { useLocalStorageBoolean } from '@/lib/hooks/useLocalStorageBoolean'

import { AddCardCta }                             from './add-card-cta'
import { HelpRow }                                from './help-row'
import { NAV_SECTIONS, type NavItemConfig }       from './nav-config'
import { NavItem, WeakSpotCountNavItem }          from './nav-item'
import { NavSection }                             from './nav-section'
import { TodayStripCollapsed, TodayStripExpanded } from './today-strip'
import { UserMenu }                                from './user-menu'

interface Props {
  user: User | null
}

/** Time estimate for the Reviews row subLabel. 0.5 min per card (30 sec) is
 *  a conservative average across modalities; can be replaced with a per-user
 *  FSRS-derived estimate in the future. The minimum-of-1 clamp keeps the
 *  estimate from reading as "0 min" when due count is small. */
const MIN_PER_CARD = 0.5

/** Account strip: thin wrapper around UserMenu that swaps to a seal-only
 *  trigger in the collapsed rail. Kept inline since it's only used here. */
function AccountStripCollapsed({ user }: { user: User | null }): React.JSX.Element {
  // The UserMenu component itself handles the full account row; in collapsed
  // mode we render the same UserMenu but inside a narrower wrapper. The
  // UserMenu's button is w-full so it naturally fits.
  return (
    <div className="px-2 py-3 border-t border-soft-hairline shrink-0 relative z-[1] bg-warm-paper-raised">
      <UserMenu user={user} />
    </div>
  )
}

/**
 * Desktop chrome (>= lg breakpoint). Section-grouped V5.1 sidebar with:
 *  - Top vermillion hairline rule.
 *  - Brand strip (Logo + wordmark underline) with chevron collapse toggle.
 *  - Bilingual today strip (per-element kanji tooltips for learners).
 *  - Three sections led by identity kanji (練 / 書 / 析).
 *  - Reviews row CTA microcopy when due > 0.
 *  - Help and shortcuts row at the bottom (vermillion ? key chip).
 *  - Account strip via UserMenu.
 *  - Collapse-to-64px-rail with localStorage persistence + [ keyboard
 *    shortcut. The outer aside animates width; the inner shell stays at
 *    its source size during the transition so content is clipped rather
 *    than reflowed.
 */
export function Sidebar({ user }: Props): React.JSX.Element {
  const [widthCollapsed, setWidthCollapsed] = useLocalStorageBoolean(
    'tomo.sidebar.collapsed',
    false,
  )
  // Delayed DOM swap: at t=0 of collapse, widthCollapsed flips true (drives
  // the aside's CSS width transition). renderCollapsed lags 300ms (the
  // animation duration) before flipping, so the expanded DOM remains
  // visible during the contraction and the collapsed DOM appears at the
  // end. Expanding is immediate in both states.
  const [renderCollapsed, setRenderCollapsed] = useState<boolean>(widthCollapsed)

  useEffect(() => {
    if (widthCollapsed) {
      const t = window.setTimeout(() => setRenderCollapsed(true), 300)
      return () => window.clearTimeout(t)
    }
    setRenderCollapsed(false)
    return undefined
  }, [widthCollapsed])

  // Keyboard shortcut: `[` toggles the sidebar. Ignored when typing in an
  // input or textarea so it doesn't fight content editing.
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key !== '[') return
      const target = e.target as HTMLElement | null
      if (target !== null) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      e.preventDefault()
      // Functional update so the handler doesn't close over `widthCollapsed`;
      // lets the listener attach once instead of re-subscribing every toggle.
      setWidthCollapsed((c) => !c)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setWidthCollapsed])

  // Reviews row microcopy: derived from the real due-cards query.
  const dueCardsQuery = useDueCards()
  const dueCount      = dueCardsQuery.data?.items.length ?? 0

  const reviewsSubLabel = dueCount > 0
    ? `${dueCount} card${dueCount === 1 ? '' : 's'} · ~${Math.max(1, Math.ceil(dueCount * MIN_PER_CARD))} min`
    : undefined

  // Decorate the Reviews nav item with the dynamic subLabel. The static
  // NAV_SECTIONS config can't carry it (depends on live data). We rebuild
  // the items array with the augmented Reviews item. Weak-spots rows are
  // dispatched through `WeakSpotCountNavItem` so the unresolved-count chip
  // renders at the top level (the in-file dispatch in nav-item.tsx only
  // fires for child rows of a parent-with-children, which top-level rows
  // aren't).
  function decorate(item: NavItemConfig): React.ReactNode {
    if (item.hasWeakSpotCount === true) {
      return <WeakSpotCountNavItem key={item.href} item={item} collapsed={renderCollapsed} />
    }
    if (item.hasDueCount === true && reviewsSubLabel !== undefined) {
      return <NavItem key={item.href} item={item} collapsed={renderCollapsed} subLabel={reviewsSubLabel} />
    }
    return <NavItem key={item.href} item={item} collapsed={renderCollapsed} />
  }

  return (
    // DELIBERATE: animates the `width` layout property. The visual metaphor
    // is "chrome contracting around content": the rail compresses while the
    // inner shell stays at expanded width and gets clipped. Replacing width
    // with transform-based motion would invert the metaphor. The cost is
    // 300ms of main-thread reflow on a user-triggered, infrequent action.
    <aside
      className={[
        'hidden lg:flex relative shrink-0 h-screen overflow-hidden',
        'bg-warm-paper-raised border-r border-soft-hairline',
        'transition-[width] duration-300 ease-out',
        widthCollapsed ? 'w-16' : 'w-72',
      ].join(' ')}
    >
      {/* Top vermillion hairline rule */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-inari-vermillion/60 z-20"
      />

      {/* Inner shell: subtract 1px to compensate for the aside's border-r.
          Tailwind's default box-sizing is border-box, so w-72/w-16 already
          include the border; matching that exactly aligns inner content with
          the aside's visible content center instead of drifting 0.5px right.
          A gentle opacity dip during the collapse window softens the clip
          edge: content dims to 60% as it's cut, then fades back to 100%
          after the DOM swap lands. */}
      <div
        className={[
          'flex flex-col h-full transition-opacity duration-300 ease-out',
          widthCollapsed && !renderCollapsed ? 'opacity-60' : 'opacity-100',
        ].join(' ')}
        style={{ width: renderCollapsed ? 'calc(4rem - 1px)' : 'calc(18rem - 1px)' }}
      >
        {/* Brand strip: logo + wordmark underline (expanded) or just the
            collapse toggle (collapsed). h-16 in both modes so vertical
            geometry doesn't shift. */}
        {renderCollapsed ? (
          <div className="relative flex items-center justify-center h-16 px-2 border-b border-soft-hairline shrink-0">
            <span className="animate-card-reveal">
              <CollapseToggle
                collapsed={widthCollapsed}
                onClick={() => setWidthCollapsed(!widthCollapsed)}
              />
            </span>
          </div>
        ) : (
          <div className="relative flex items-center justify-between h-16 px-4 border-b border-soft-hairline shrink-0">
            <Link
              href="/today"
              aria-label="Go to Reviews"
              className="relative rounded-[2px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              <Logo size={48} wordmarkSize="lg" priority />
              <span
                aria-hidden="true"
                className="absolute h-px bg-inari-vermillion/75"
                style={{ left: '3.375rem', right: 0, bottom: '0.6rem' }}
              />
            </Link>
            <CollapseToggle
              collapsed={widthCollapsed}
              onClick={() => setWidthCollapsed(!widthCollapsed)}
            />
          </div>
        )}

        {/* Today strip */}
        {renderCollapsed ? <TodayStripCollapsed /> : <TodayStripExpanded />}

        {/* Primary CTA — sits between daily context and section nav so the
            create-card action lives next to today's practice signal. */}
        <div className="shrink-0 border-b border-soft-hairline">
          <AddCardCta collapsed={renderCollapsed} />
        </div>

        {/* Nav body */}
        <nav
          aria-label="Main navigation"
          className={renderCollapsed
            ? 'relative z-[1] flex-1 overflow-y-auto flex flex-col'
            : 'relative z-[1] flex-1 overflow-y-auto py-2'
          }
        >
          {NAV_SECTIONS.map((section, index) => (
            <NavSection
              key={section.label}
              label={section.label}
              kanji={section.kanji}
              collapsed={renderCollapsed}
              isFirst={index === 0}
            >
              {section.items.map((item) => decorate(item))}
            </NavSection>
          ))}
        </nav>

        {/* Help row */}
        <div className="shrink-0 border-t border-soft-hairline py-1 relative z-[1] bg-warm-paper-raised">
          <HelpRow collapsed={renderCollapsed} />
        </div>

        {/* Account strip */}
        <AccountStripCollapsed user={user} />
      </div>
    </aside>
  )
}

/** Chevron toggle that flips its arrow based on widthCollapsed (immediate
 *  intent, not delayed DOM state). [-key shortcut is announced via
 *  aria-keyshortcuts and the tooltip. */
function CollapseToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean
  onClick:   () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      aria-keyshortcuts="["
      title={(collapsed ? 'Expand sidebar' : 'Collapse sidebar') + ' · ['}
      className="relative z-[2] flex items-center justify-center w-11 h-11 rounded-[2px] text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
    >
      {collapsed
        ? <IconChevronRight aria-hidden="true" className="w-4 h-4" />
        : <IconChevronLeft  aria-hidden="true" className="w-4 h-4" />}
    </button>
  )
}

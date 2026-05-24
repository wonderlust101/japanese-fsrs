'use client'

import { useMemo } from 'react'

import { ToolbarChip } from '@/components/ui/ToolbarChip'
import { DecksMenu, MenuItem, MenuSeparator } from '@/app/(app)/decks/_components/decks-menu'

import {
  BUILTIN_VIEWS,
  deriveViewCount,
  findViewById,
  type SavedView,
  type SavedViewGroup,
} from './saved-views-storage'
import type { CardQualityIssue } from './cards-quality-data'

interface Props {
  /** Currently active view id; null = "All cards" implicit default. */
  activeId:   string | null
  /** True when the live filter state diverges from the active view's recipe. */
  modified:   boolean
  /** Quality data drives live counts on maintenance views. */
  qualityIssues?: ReadonlyArray<CardQualityIssue> | undefined
  onPick:     (next: string | null) => void
  /**
   * Callback-slot ref: when provided, this component registers a
   * function the parent can invoke to programmatically click the
   * trigger (used by the page-level V-keybinding). Implemented as a
   * function-in-ref rather than forwardRef because DecksMenu's
   * render-prop chain doesn't pass through forwardRef cleanly.
   */
  triggerRef?: React.MutableRefObject<(() => void) | null> | undefined
}

/**
 * View picker anchored at the left edge of the toolbar. Replaces the old
 * `SavedViewPills` row by collapsing every preset into a single dropdown,
 * which is the change that buys back ~48px of vertical space on the
 * cards page.
 *
 * Visual model: the trigger reads `View: <name>` with a small
 * vermillion dot when the live state has diverged from the view's
 * recipe ("modified" indicator). Menu groups views into core / attention
 * / maintenance with separators so the list scans top-to-bottom.
 *
 * Counts: maintenance views render a right-aligned tabular-nums count
 * derived from `qualityIssues`. Views with `countSource.kind === 'none'`
 * render nothing on the right — preferred over rendering "0" for the
 * "All cards" entry, which would mis-imply emptiness.
 */
export function CardsViewDropdown({
  activeId, modified, qualityIssues, onPick, triggerRef,
}: Props): React.JSX.Element {
  const active = findViewById(activeId) ?? findViewById('all')
  const activeLabel = active?.label ?? 'All cards'

  const grouped = useMemo(() => groupViews(BUILTIN_VIEWS), [])

  return (
    <DecksMenu
      align="start"
      menuClassName="min-w-[16rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef: menuTriggerRef }) => {
        // Register the menu's `onClick` into the parent's callback-slot
        // ref on every render so the V keybinding has a live handle. No
        // useEffect needed: the assignment is idempotent and the
        // closure captures the latest onClick.
        if (triggerRef !== undefined) triggerRef.current = onClick
        return (
        <ToolbarChip
          ref={menuTriggerRef}
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          state={activeId !== null && activeId !== 'all' ? 'selected' : 'default'}
          // The View chip lives in Row 1 (visible on every viewport),
          // so it must hit 44px touch target on mobile without
          // disturbing the 36px density of the desktop toolbar. The
          // min-height override is the simplest way to do this without
          // forking the SIZE_CLASS scale or fighting class-merge order.
          className="min-h-[44px] sm:min-h-0"
          trailingNode={<Chevron />}
          leadingNode={
            <span
              lang="ja"
              aria-hidden="true"
              className="font-display text-base leading-none translate-y-[0.05em] text-inari-vermillion"
            >
              観
            </span>
          }
        >
          {/* "View" prefix hidden on mobile so the chip stays compact
              and the search field next to it gets enough room. On
              desktop the prefix anchors the affordance's identity. */}
          <span className="text-faded-sumi hidden sm:inline">View </span>
          {/* Modified signal: a faint vermillion underline beneath the
              view-name text reads instantly as "edited" without adding
              an extra widget. Replaces the previous 6px dot, which was
              too small to be noticed at desktop reading distance. The
              underline uses box-shadow rather than text-decoration so
              its offset stays visually consistent with our 2px corner
              radius register. The hidden ARIA-only span preserves the
              "View has been modified" announcement for SR users. */}
          <span
            className={[
              'text-sumi-ink',
              modified
                // 60% opacity so the modified signal reads as quiet
                // marginalia rather than a competing accent. The
                // critique flagged the previous 100% saturation as
                // louder than the rest of the chrome.
                ? 'shadow-[inset_0_-1px_0_0_color-mix(in_srgb,var(--color-inari-vermillion)_60%,transparent)]'
                : '',
            ].join(' ')}
          >
            {activeLabel}
          </span>
          {modified && (
            <span className="sr-only">, modified</span>
          )}
        </ToolbarChip>
        )
      }}
      renderItems={({ close }) => (
        <>
          {grouped.map((group, gi) => (
            <div key={group.id}>
              {gi > 0 && <MenuSeparator />}
              {group.label !== null && (
                <div className="px-3 pt-2 pb-1 font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
                  {group.label}
                </div>
              )}
              {group.views.map((v) => {
                const count = deriveViewCount(v, qualityIssues)
                const isActive = v.id === (activeId ?? 'all')
                return (
                  <MenuItem
                    key={v.id}
                    selected={isActive}
                    onClick={() => {
                      onPick(v.id === 'all' ? null : v.id)
                      close()
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="truncate">{v.label}</span>
                      {count !== null && (
                        <span
                          className={[
                            'shrink-0 font-mono text-sm tabular-nums',
                            count === 0 ? 'text-faded-sumi/60' : 'text-faded-sumi',
                          ].join(' ')}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  </MenuItem>
                )
              })}
            </div>
          ))}
        </>
      )}
    />
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

interface ViewGroup {
  id:     SavedViewGroup
  label:  string | null
  views:  ReadonlyArray<SavedView>
}

const GROUP_LABEL: Record<SavedViewGroup, string | null> = {
  core:        null,
  attention:   'Attention',
  maintenance: 'Maintenance',
}

function groupViews(views: ReadonlyArray<SavedView>): ReadonlyArray<ViewGroup> {
  const order: ReadonlyArray<SavedViewGroup> = ['core', 'attention', 'maintenance']
  return order.map((id) => ({
    id,
    label: GROUP_LABEL[id],
    views: views.filter((v) => v.group === id),
  })).filter((g) => g.views.length > 0)
}

function Chevron(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-faded-sumi"
    >
      <path d="M2 4l3 3 3-3" />
    </svg>
  )
}

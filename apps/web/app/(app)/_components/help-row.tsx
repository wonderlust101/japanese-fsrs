'use client'

import { useHelpDialogActions } from '@/stores/useHelpDialogStore'

interface HelpRowProps {
  /** Icon-only render at 64px collapsed rail width. Mutually exclusive with `mobile`. */
  collapsed?: boolean
  /** Mobile drawer variant: no key chip (no keyboard), just the label. */
  mobile?:    boolean
}

function HelpKeyChip(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 border border-inari-vermillion/45 rounded-[2px] font-mono text-[11px] text-inari-vermillion-deep"
    >
      ?
    </span>
  )
}

/**
 * The Help row at the bottom of the sidebar. Three render modes:
 *  - mobile:    "Help" label only (no kbd on touch).
 *  - collapsed: just the `?` chip, centered.
 *  - default:   chip + "Help and shortcuts" label.
 *
 * Pressing the `?` key elsewhere in the app is the intended global
 * shortcut; this row is its visible anchor.
 */
export function HelpRow({ collapsed = false, mobile = false }: HelpRowProps): React.JSX.Element {
  const { openHelp } = useHelpDialogActions()

  if (mobile) {
    return (
      <button
        type="button"
        aria-label="Help"
        onClick={openHelp}
        className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-[2px] text-sm font-medium text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash"
      >
        <span className="truncate flex-1 text-left">Help</span>
      </button>
    )
  }

  if (collapsed) {
    return (
      <button
        type="button"
        title="Help and shortcuts · ?"
        aria-label="Help and shortcuts"
        aria-keyshortcuts="?"
        onClick={openHelp}
        className="w-full flex items-center justify-center min-h-[44px] rounded-[2px] hover:bg-cream-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash"
      >
        <HelpKeyChip />
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label="Help and shortcuts"
      aria-keyshortcuts="?"
      title="Help and shortcuts · ?"
      onClick={openHelp}
      className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-[2px] text-sm font-medium text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash"
    >
      <span className="shrink-0 transition-colors duration-200">
        <HelpKeyChip />
      </span>
      <span className="truncate flex-1 text-left">Help and shortcuts</span>
    </button>
  )
}

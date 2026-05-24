'use client'

import Link from 'next/link'

import { IconPlus } from '@/components/icons/chrome-marks'

interface AddCardCtaProps {
  /** Optional click handler (used by MobileDrawer to close the drawer
   *  before route change). Sidebar omits it. */
  onNavigate?: () => void
  /** 64px rail variant: renders a 44×44 vermillion square with the +
   *  glyph alone. Label moves to `aria-label` + `title`. */
  collapsed?:  boolean
}

const HREF = '/add'
const LABEL = 'Add New Card'

/**
 * Primary creation CTA for the sidebar / drawer. Sits between the daily
 * Today strip and the section nav so the action that creates new study
 * material lives next to the daily context. Vermillion-filled to commit
 * the brand accent to the highest-priority action; warm-paper-raised
 * label so the contrast holds at AA against the saturated background.
 *
 * Brand devices: the leading `IconPlus` is the 十 kanji glyph (calligraphic
 * terminal taper baked in), so the CTA reads as Tomo's "plus" rather than
 * a generic UI plus.
 *
 * The collapsed rail variant drops the label and renders a 44×44 square
 * with just the glyph. Tooltip + aria-label keep the action discoverable.
 */
export function AddCardCta({
  onNavigate,
  collapsed = false,
}: AddCardCtaProps): React.JSX.Element {
  const baseLink = [
    'group relative inline-flex items-center justify-center',
    'rounded-xs bg-inari-vermillion text-warm-paper-raised',
    'transition-colors duration-200',
    'hover:bg-inari-vermillion-deep',
    'active:bg-inari-vermillion-deep active:shadow-pressed',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
  ].join(' ')

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <Link
          href={HREF}
          {...(onNavigate !== undefined && { onClick: onNavigate })}
          aria-label={LABEL}
          title={LABEL}
          className={`${baseLink} h-11 w-12 mx-auto`}
        >
          <IconPlus className="w-6 h-6" />
        </Link>
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      <Link
        href={HREF}
        {...(onNavigate !== undefined && { onClick: onNavigate })}
        className={`${baseLink} h-11 w-full gap-2 px-4 text-sm font-medium`}
      >
        <IconPlus className="w-5 h-5 shrink-0" />
        <span className="truncate">{LABEL}</span>
      </Link>
    </div>
  )
}

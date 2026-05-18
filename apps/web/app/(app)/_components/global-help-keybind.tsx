'use client'

import { useEffect } from 'react'

import { useHelpDialogActions, useHelpDialogOpen } from '@/stores/useHelpDialogStore'

// Listens globally for the `?` key (Shift+/ on US/UK layouts) and opens the
// HelpDialog — unless the user is typing in an input/textarea/contenteditable.
// Esc closes the dialog from anywhere; the Dialog primitive also handles this
// natively, this listener is a belt-and-braces fallback.

export function GlobalHelpKeybind(): null {
  const open = useHelpDialogOpen()
  const { openHelp, closeHelp } = useHelpDialogActions()

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key === '?' && !isTypingTarget(e.target) && !open) {
        e.preventDefault()
        openHelp()
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        closeHelp()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, openHelp, closeHelp])

  return null
}

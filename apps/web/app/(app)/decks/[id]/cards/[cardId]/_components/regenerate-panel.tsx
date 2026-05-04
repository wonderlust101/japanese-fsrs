'use client'

import { Button } from '@/components/ui/Button'

interface Props {
  title:        string
  onUseThese:   () => void
  onTryAgain:   () => void
  onDismiss:    () => void
  isSaving:     boolean
  isRegenerating: boolean
  children:     React.ReactNode
}

export function RegeneratePanel({
  title,
  onUseThese,
  onTryAgain,
  onDismiss,
  isSaving,
  isRegenerating,
  children,
}: Props): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-md)] border-2 border-dashed border-primary-300 bg-primary-50/40 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
          {title}
        </h3>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss preview"
          className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
        >
          ✕
        </button>
      </header>

      <div>{children}</div>

      <footer className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onUseThese}
          loading={isSaving}
          disabled={isRegenerating}
        >
          Use these
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onTryAgain}
          loading={isRegenerating}
          disabled={isSaving}
        >
          Try again
        </Button>
      </footer>
    </div>
  )
}

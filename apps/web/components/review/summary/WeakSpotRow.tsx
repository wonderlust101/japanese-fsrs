import Link from 'next/link'

import { Button }       from '@/components/ui/Button'
import { FuriganaText } from '@/components/ui/FuriganaText'

import type { SessionWeakSpot } from '@fsrs-japanese/shared-types'

interface Props {
  weakSpot:     SessionWeakSpot
  meaning?:  string | undefined
  /** Optional miss-context tag rendered to the right (e.g. "Hard×2"). */
  missTag?:  string | undefined
  onRepair?: ((weakSpot: SessionWeakSpot) => void) | undefined
}

/**
 * Problem-card row used in the Review Summary teaching panel.
 *
 * Geometry: Japanese hero on the left (Noto Sans JP, larger than chrome),
 * reading + meaning beneath it in Faded Sumi, a small miss-context tag,
 * and an Editorial-register Repair affordance on the far right. The whole
 * row's main surface is a Link to Card Detail; the Repair button is its
 * own focusable element so the row still feels like one click for the
 * common "see the card" case while keeping Repair as an explicit choice.
 */
export function WeakSpotRow({ weakSpot, meaning, missTag, onRepair }: Props): React.JSX.Element {
  const cardHref = `/decks/${weakSpot.deckId}/cards/${weakSpot.cardId}`

  return (
    <div className="group flex items-center gap-4 py-3.5">
      <Link
        href={cardHref}
        className="flex-1 min-w-0 flex items-baseline gap-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px]"
      >
        <span className="shrink-0 text-xl md:text-2xl font-medium text-sumi-ink group-hover:text-inari-vermillion transition-colors">
          {weakSpot.reading !== null ? (
            <FuriganaText text={weakSpot.word} reading={weakSpot.reading} className="font-japanese" />
          ) : (
            <span lang="ja" className="font-japanese">{weakSpot.word}</span>
          )}
        </span>

        {meaning !== undefined && meaning !== '' && (
          <span className="hidden sm:inline text-sm text-faded-sumi truncate">
            {meaning}
          </span>
        )}
      </Link>

      {missTag !== undefined && (
        <span className="hidden md:inline-block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-faded-sumi">
          {missTag}
        </span>
      )}

      <div className="hidden sm:block">
        <Button
          variant="editorial"
          size="sm"
          onClick={() => onRepair?.(weakSpot)}
        >
          Repair
        </Button>
      </div>

      {/* Mobile-only full-width repair affordance lives outside the row;
          on mobile the whole row stacks tighter and the Repair button
          renders as a separate row beneath. */}
      <div className="sm:hidden">
        <Button
          variant="editorial"
          size="sm"
          iconOnly
          aria-label={`Repair ${weakSpot.word}`}
          onClick={() => onRepair?.(weakSpot)}
        >
          →
        </Button>
      </div>
    </div>
  )
}

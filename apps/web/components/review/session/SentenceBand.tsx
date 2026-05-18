'use client'

import { useState } from 'react'

import { AudioButton }  from './AudioButton'
import type { FuriganaMode } from '@/stores/useSessionPreferencesStore'
import { FuriganaText } from '@/components/ui/FuriganaText'
import { cn } from '@/lib/utils'

interface SentenceBandProps {
  ja:           string
  furigana?:    string
  en?:          string
  audioSrc?:    string | null
  furiganaMode: FuriganaMode
  audioMuted:   boolean
  autoplay?:    boolean
}

// Sentence + furigana band. Furigana mode comes from the learner's session
// preferences:
//   - 'always': ruby is visible
//   - 'hover':  ruby hidden by default, revealed on hover (desktop) or
//               tap-to-toggle (mobile and any pointer-coarse environment)
//   - 'off':    ruby never rendered
//
// The furigana string is the existing card field; we render it directly as
// the <rt> content. (The legacy `furigana:` syntax for Anki templates is
// already pre-processed server-side for our cards.)

export function SentenceBand({
  ja,
  furigana,
  en,
  audioSrc = null,
  furiganaMode,
  audioMuted,
  autoplay = false,
}: SentenceBandProps): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  const renderRuby = furiganaMode !== 'off' && furigana !== undefined && furigana !== ''

  function handleClick() {
    if (furiganaMode === 'hover') setRevealed((r) => !r)
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <p
          lang="ja"
          onClick={handleClick}
          className={cn(
            'font-japanese text-xl md:text-2xl leading-relaxed text-sumi-ink flex-1',
            furiganaMode === 'hover' ? 'cursor-pointer group' : '',
          )}
          data-furigana-mode={furiganaMode}
          data-revealed={revealed ? 'true' : 'false'}
        >
          {renderRuby ? (
            <FuriganaText
              text={ja}
              reading={furigana ?? ''}
              rtSize="0.45em"
              rtRevealMode={
                furiganaMode === 'always' ? 'always'
                : revealed                 ? 'revealed'
                                           : 'hover'
              }
            />
          ) : (
            ja
          )}
        </p>
        <AudioButton src={audioSrc} label="Play sentence audio" size="sm" autoplay={autoplay} muted={audioMuted} />
      </div>
      {en !== undefined && en !== '' && (
        <p className="text-sm md:text-base text-faded-sumi leading-relaxed">{en}</p>
      )}
    </div>
  )
}

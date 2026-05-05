'use client'

import { useState, useEffect, useRef } from 'react'
import type { GeneratedCardData } from '@fsrs-japanese/shared-types'

export function GeneratedCardPreview({ data }: { data: GeneratedCardData }): React.JSX.Element {
  const [visible, setVisible]         = useState(false)
  const [sentenceIdx, setSentenceIdx] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    frameRef.current = requestAnimationFrame(() => setVisible(true))
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [])

  const sentences = data.exampleSentences ?? []
  const sentence  = sentences[sentenceIdx]

  return (
    <div
      className={[
        'bg-neutral-0 rounded-[var(--radius-lg)] border border-neutral-200 p-6 space-y-4',
        'transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      {/* Word + reading */}
      <div>
        <p lang="ja" className="text-3xl font-bold text-neutral-900">{data.word}</p>
        <p lang="ja" className="text-sm text-neutral-500 mt-1">{data.reading}</p>
      </div>

      {/* Meaning + part of speech */}
      <div className="border-t border-neutral-100 pt-4">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Meaning</p>
        <p className="text-base text-neutral-800">{data.meaning}</p>
        {data.partOfSpeech !== undefined && (
          <p className="text-xs text-neutral-500 mt-1">{data.partOfSpeech}</p>
        )}
      </div>

      {/* Pitch accent */}
      {data.pitchAccent !== undefined && (
        <p className="text-xs text-neutral-500">Pitch: {data.pitchAccent}</p>
      )}

      {/* Kanji breakdown */}
      {data.kanjiBreakdown !== undefined && data.kanjiBreakdown.length > 0 && (
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Kanji</p>
          <div className="flex flex-wrap gap-2">
            {data.kanjiBreakdown.map((k) => (
              <span
                key={k.kanji}
                className="text-sm bg-neutral-100 rounded-[var(--radius-sm)] px-2 py-1"
              >
                <span lang="ja" className="font-medium">{k.kanji}</span>
                <span className="text-neutral-500 ml-1">{k.meaning}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Example sentences with prev/next pagination */}
      {sentences.length > 0 && sentence !== undefined && (
        <div className="border-t border-neutral-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
              Sentences ({sentenceIdx + 1} of {sentences.length})
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSentenceIdx((i) => Math.max(0, i - 1))}
                disabled={sentenceIdx === 0}
                className="text-xs px-2 py-0.5 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 transition-colors"
                aria-label="Previous sentence"
              >
                ◂
              </button>
              <button
                type="button"
                onClick={() => setSentenceIdx((i) => Math.min(sentences.length - 1, i + 1))}
                disabled={sentenceIdx === sentences.length - 1}
                className="text-xs px-2 py-0.5 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 transition-colors"
                aria-label="Next sentence"
              >
                ▸
              </button>
            </div>
          </div>
          <p lang="ja" className="text-base text-neutral-800 leading-relaxed">{sentence.ja}</p>
          <p className="text-sm text-neutral-500 mt-1">{sentence.en}</p>
        </div>
      )}

      {/* Mnemonic */}
      {data.mnemonic !== undefined && (
        <div className="border-t border-neutral-100 pt-4">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Mnemonic</p>
          <p className="text-sm text-neutral-700 italic">{data.mnemonic}</p>
        </div>
      )}
    </div>
  )
}

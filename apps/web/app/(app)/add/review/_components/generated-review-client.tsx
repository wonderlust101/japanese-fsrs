'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'

import type { ApiDueCard } from '@fsrs-japanese/shared-types'

import { Button }       from '@/components/ui/Button'
import { Checkbox }     from '@/components/ui/Checkbox'
import { Logo }         from '@/components/ui/Logo'
import { PageHeader }   from '@/components/ui/PageHeader'
import { QuietLink }    from '@/components/ui/QuietLink'
import { SectionCard }  from '@/components/ui/SectionCard'
import { Textarea }     from '@/components/ui/Textarea'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'
import { CardBack }     from '@/components/review/session/CardBack'
import { CardFront }    from '@/components/review/session/CardFront'
import { MoreDisclosure } from '@/components/review/MoreDisclosure'
import { useDecks }     from '@/lib/api/decks'
import {
  generateCardPreviewAction,
  generateSentencesAction,
  saveCardAction,
} from '@/lib/actions/cards.actions'
import {
  useCaptureDraftActions,
  useCaptureDraftStore,
} from '@/stores/useCaptureDraftStore'
import { cn } from '@/lib/utils'

// ── Local edit state ──────────────────────────────────────────────────────────
//
// The Generated Card Review page is a correction surface, not a generator. It
// reads a CaptureDraft (word + sentence + entry mode + deck), optionally
// triggers AI generation to seed the back-of-card fields, and lets the
// learner adjust before persisting. The shape below matches what
// `card-fields.ts` already reads on the session preview, so the synthetic
// preview card we build from this state renders identically to a real card.

interface CardFields {
  reading:      string
  meaning:      string
  partOfSpeech: string
  sentenceJa:   string
  sentenceEn:   string
  sentenceFuri: string
  nuance:       string
  mnemonic:     string
  pitchAccent:  string
  tags:         string
}

const EMPTY_FIELDS: CardFields = {
  reading:      '',
  meaning:      '',
  partOfSpeech: '',
  sentenceJa:   '',
  sentenceEn:   '',
  sentenceFuri: '',
  nuance:       '',
  mnemonic:     '',
  pitchAccent:  '',
  tags:         '',
}

interface CardTypeSelection {
  comprehension: boolean
  production:    boolean
  listening:     boolean
}

const DEFAULT_TYPES: CardTypeSelection = {
  comprehension: true,
  production:    false,
  listening:     false,
}

type ApiCardType = 'comprehension' | 'production' | 'listening'

const TYPE_LABEL: Record<ApiCardType, string> = {
  comprehension: 'Vocabulary recognition',
  production:    'Production (English → Japanese)',
  listening:     'Listening',
}

// ── Synthetic preview card ───────────────────────────────────────────────────
//
// Wraps the live edit state into an ApiDueCard so CardFront / CardBack can
// render unchanged. Same trick as `add-session-preview.tsx`, extended to
// fill the back too.

interface BuildPreviewArgs {
  word:    string
  fields:  CardFields
  picture: string | null
}

function buildPreviewCard({ word, fields, picture }: BuildPreviewArgs): ApiDueCard {
  const example = fields.sentenceJa.trim().length > 0
    ? [{ ja: fields.sentenceJa, en: fields.sentenceEn, furigana: fields.sentenceFuri || fields.sentenceJa }]
    : undefined

  const fieldsData: Record<string, unknown> = {
    word,
    reading:      fields.reading,
    meaning:      fields.meaning,
    partOfSpeech: fields.partOfSpeech,
    mnemonic:     fields.mnemonic,
    nuance:       fields.nuance,
    pitchAccent:  fields.pitchAccent,
  }
  if (example !== undefined) fieldsData.exampleSentences = example
  if (picture !== null)      fieldsData.picture = picture

  return {
    id:         'preview-card',
    deckId:     'preview-deck',
    cardType:   'comprehension',
    jlptLevel:  null,
    state:      0,
    due:        new Date().toISOString(),
    layoutType: 'vocabulary',
    fieldsData,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GeneratedReviewClient(): React.JSX.Element {
  const router         = useRouter()
  const [, startNav]   = useTransition()
  const draft          = useCaptureDraftStore((s) => s.draft)
  const captureActions = useCaptureDraftActions()

  // Guard: if there's no draft (e.g. deep link or browser back hours later),
  // bounce to /add. We don't try to recover; capture is upstream of us.
  const noDraft = draft.word.trim().length === 0

  useEffect(() => {
    if (!noDraft) return
    router.replace('/add')
  }, [noDraft, router])

  // ── Live edit state ────────────────────────────────────────────────────
  const [fields,   setFields]   = useState<CardFields>(() => seedFields(draft))
  const [picture,  setPicture]  = useState<string | null>(draft.imageDataUrl)
  const [deckId,   setDeckId]   = useState<string | null>(draft.deckId)
  const [types,    setTypes]    = useState<CardTypeSelection>(DEFAULT_TYPES)
  const [flipped,  setFlipped]  = useState<boolean>(false)

  // AI generation state. We trigger generation once on mount in 'generate'
  // mode, when the reading is still empty (otherwise the user has already
  // been here and is coming back to a hydrated draft).
  const isAiPath = draft.mode === 'generate'
  const [generating,    setGenerating]    = useState<boolean>(isAiPath && draft.reading === '')
  const [aiError,       setAiError]       = useState<string | null>(null)
  const [regenSentence, setRegenSentence] = useState<boolean>(false)
  const [regenMnemonic, setRegenMnemonic] = useState<boolean>(false)

  // Save state
  const [saving,    setSaving]    = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved,     setSaved]     = useState<{ count: number; deckName: string } | null>(null)

  // ── Decks ─────────────────────────────────────────────────────────────
  const decksQuery = useDecks(50)
  const deckOptions = useMemo<ReadonlyArray<TomoSelectOption<string>>>(() => {
    const items = decksQuery.data?.items ?? []
    return items.map((d) => ({
      value: d.id,
      label: d.name.trim().length > 0 ? d.name : 'Untitled deck',
    }))
  }, [decksQuery.data])

  const deckName = useMemo(() => {
    if (deckId === null) return null
    const match = decksQuery.data?.items.find((d) => d.id === deckId)
    return match?.name ?? null
  }, [deckId, decksQuery.data])

  // ── Trigger AI generation once on mount (AI path only) ────────────────
  useEffect(() => {
    if (!isAiPath || !generating) return
    let cancelled = false

    void generateCardPreviewAction(draft.word.trim())
      .then((data) => {
        if (cancelled) return
        const first = data.exampleSentences?.[0]
        setFields((prev) => ({
          ...prev,
          reading:      data.reading,
          meaning:      data.meaning,
          partOfSpeech: data.partOfSpeech ?? prev.partOfSpeech,
          mnemonic:     data.mnemonic ?? prev.mnemonic,
          pitchAccent:  data.pitchAccent ?? prev.pitchAccent,
          // Prefer the AI sentence when the user didn't provide one;
          // otherwise keep what the learner typed at capture time.
          sentenceJa:   prev.sentenceJa.length > 0 ? prev.sentenceJa : first?.ja       ?? prev.sentenceJa,
          sentenceEn:   prev.sentenceEn.length > 0 ? prev.sentenceEn : first?.en       ?? prev.sentenceEn,
          sentenceFuri: prev.sentenceFuri.length > 0 ? prev.sentenceFuri : first?.furigana ?? prev.sentenceFuri,
        }))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Generation failed.'
        setAiError(msg)
      })
      .finally(() => {
        if (cancelled) return
        setGenerating(false)
      })

    return () => { cancelled = true }
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────
  const previewCard = useMemo(
    () => buildPreviewCard({ word: draft.word.trim(), fields, picture }),
    [draft.word, fields, picture],
  )

  const selectedTypes: ApiCardType[] = useMemo(() => {
    const out: ApiCardType[] = []
    if (types.comprehension) out.push('comprehension')
    if (types.production)    out.push('production')
    if (types.listening)     out.push('listening')
    return out
  }, [types])

  const blockers = useMemo<string[]>(() => {
    const list: string[] = []
    if (fields.meaning.trim().length === 0) list.push('Add a definition to save.')
    if (deckId === null)                    list.push('Pick a deck to save into.')
    if (selectedTypes.length === 0)         list.push('Choose at least one card type.')
    if (fields.sentenceJa.trim().length > 0
        && !fields.sentenceJa.includes(draft.word.trim())
        && draft.word.trim().length > 0) {
      list.push('Your sentence doesn’t include the word — fix the sentence or word to save.')
    }
    return list
  }, [fields.meaning, fields.sentenceJa, draft.word, deckId, selectedTypes])

  const canSave = !generating && !saving && blockers.length === 0

  // ── Field updaters ────────────────────────────────────────────────────
  const updateField = useCallback(
    <K extends keyof CardFields>(key: K, value: CardFields[K]): void => {
      setFields((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  // ── Regenerate handlers ───────────────────────────────────────────────
  //
  // The AI regenerate endpoints take a cardId — but at this point in the
  // flow the card hasn't been saved yet. Sentence regeneration is wired
  // through the AI card-preview endpoint with the current word; mnemonic
  // regeneration is gated on save (the dedicated endpoint requires a saved
  // card). We surface the constraint plainly rather than fake the call.

  const onRegenSentence = useCallback((): void => {
    if (regenSentence || generating) return
    setRegenSentence(true)
    setAiError(null)
    void generateCardPreviewAction(draft.word.trim())
      .then((data) => {
        const first = data.exampleSentences?.[0]
        if (first !== undefined) {
          setFields((prev) => ({
            ...prev,
            sentenceJa:   first.ja,
            sentenceEn:   first.en,
            sentenceFuri: first.furigana,
          }))
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Regeneration failed.'
        setAiError(msg)
      })
      .finally(() => setRegenSentence(false))
  }, [draft.word, regenSentence, generating])

  // Avoid an unused-symbol warning while reserving the endpoint for the
  // post-save iteration (mnemonic regeneration needs a card id).
  void generateSentencesAction

  const onRegenMnemonic = useCallback((): void => {
    if (regenMnemonic || generating) return
    setRegenMnemonic(true)
    setAiError(null)
    void generateCardPreviewAction(draft.word.trim())
      .then((data) => {
        if (data.mnemonic !== undefined && data.mnemonic.length > 0) {
          setFields((prev) => ({ ...prev, mnemonic: data.mnemonic ?? prev.mnemonic }))
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Regeneration failed.'
        setAiError(msg)
      })
      .finally(() => setRegenMnemonic(false))
  }, [draft.word, regenMnemonic, generating])

  // ── Save ──────────────────────────────────────────────────────────────
  const onSave = useCallback(async (): Promise<void> => {
    if (!canSave || deckId === null) return
    setSaving(true)
    setSaveError(null)
    try {
      const fieldsData = buildFieldsData(draft.word.trim(), fields, picture)
      // Save one card per selected type. The API takes a single cardType
      // per request; we fire sequentially so a partial failure surfaces
      // clearly without orphaning later writes.
      for (const cardType of selectedTypes) {
        await saveCardAction(deckId, {
          mode: 'manual',
          fieldsData,
          cardType,
          layoutType: 'vocabulary',
        })
      }
      setSaved({ count: selectedTypes.length, deckName: deckName ?? 'your deck' })
      captureActions.reset()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save the card.'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }, [canSave, deckId, draft.word, fields, picture, selectedTypes, deckName, captureActions])

  // ⌘/Ctrl + Enter to save when allowed.
  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'Enter') return
      if (!canSave) return
      e.preventDefault()
      void onSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canSave, onSave])

  // ── Render guards ─────────────────────────────────────────────────────
  if (noDraft) return <div className="px-6 pt-16 text-sm text-faded-sumi" role="status">Loading…</div>

  if (saved !== null) {
    return (
      <Frame>
        <SuccessBlock
          count={saved.count}
          deckName={saved.deckName}
          onAddAnother={() => {
            startNav(() => router.push('/add'))
          }}
          onReturnToToday={() => startNav(() => router.push('/today'))}
        />
      </Frame>
    )
  }

  // ── Path-specific copy ────────────────────────────────────────────────
  const header = isAiPath
    ? {
        kanji:    '校',
        label:    'Review prepared card',
        title:    'Confirm what’s right.',
        subtitle: 'Tomo drafted this from the word and sentence you chose. Fix anything that’s off.',
      }
    : {
        kanji:    '確',
        label:    'Confirm your card',
        title:    'Fill in the back.',
        subtitle: 'Add the details a learner will see after they flip during practice.',
      }

  const saveCount = selectedTypes.length
  const saveLabel = saveCount === 0
    ? 'Save card'
    : `Save ${saveCount} ${saveCount === 1 ? 'card' : 'cards'}`

  return (
    <Frame>
      <PageHeader
        kanji={header.kanji}
        label={header.label}
        title={header.title}
        subtitle={header.subtitle}
      />

      {/* Deck — structural placement, front-loaded with the card identity */}
      <DeckRow
        options={deckOptions}
        value={deckId}
        onChange={setDeckId}
        loading={decksQuery.isLoading}
      />

      {/* Card preview — the visual anchor */}
      <PreviewBlock
        card={previewCard}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        loading={generating}
        aiError={aiError}
      />

      {/* Build-the-back-of-your-card section */}
      <BackOfCardSection
        word={draft.word.trim()}
        fields={fields}
        updateField={updateField}
        isAiPath={isAiPath}
        regenSentence={regenSentence}
        regenMnemonic={regenMnemonic}
        onRegenSentence={onRegenSentence}
        onRegenMnemonic={onRegenMnemonic}
        picture={picture}
        onClearPicture={() => setPicture(null)}
      />

      {/* Advanced — pitch, tags, etc */}
      <AdvancedDisclosure fields={fields} updateField={updateField} />

      {/* Card-type chooser anchored above Save */}
      <SaveBlock
        types={types}
        onTypesChange={setTypes}
        saveLabel={saveLabel}
        canSave={canSave}
        saving={saving}
        blockers={blockers}
        saveError={saveError}
        onSave={onSave}
      />
    </Frame>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function seedFields(draft: ReturnType<typeof useCaptureDraftStore.getState>['draft']): CardFields {
  return {
    ...EMPTY_FIELDS,
    reading:    draft.reading,
    meaning:    draft.meaning,
    mnemonic:   draft.mnemonic,
    sentenceJa: draft.sentence,
  }
}

function buildFieldsData(
  word:    string,
  fields:  CardFields,
  picture: string | null,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    word,
    reading:      fields.reading.trim(),
    meaning:      fields.meaning.trim(),
  }
  if (fields.partOfSpeech.trim().length > 0) data.partOfSpeech = fields.partOfSpeech.trim()
  if (fields.mnemonic.trim().length > 0)     data.mnemonic     = fields.mnemonic.trim()
  if (fields.nuance.trim().length > 0)       data.nuance       = fields.nuance.trim()
  if (fields.pitchAccent.trim().length > 0)  data.pitchAccent  = fields.pitchAccent.trim()
  if (fields.sentenceJa.trim().length > 0) {
    data.exampleSentences = [{
      ja:       fields.sentenceJa.trim(),
      en:       fields.sentenceEn.trim(),
      furigana: (fields.sentenceFuri.trim() || fields.sentenceJa.trim()),
    }]
  }
  if (picture !== null) data.picture = picture
  return data
}

// ── Frame ─────────────────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 content-center gap-y-8 px-6 pt-8 md:px-12 md:pt-10 lg:gap-y-10 lg:px-16 lg:pt-12">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 lg:gap-10">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Deck row ──────────────────────────────────────────────────────────────────

interface DeckRowProps {
  options:  ReadonlyArray<TomoSelectOption<string>>
  value:    string | null
  onChange: (next: string) => void
  loading:  boolean
}

function DeckRow({ options, value, onChange, loading }: DeckRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
          Deck
        </span>
        <span className="text-sm text-faded-sumi">Where this card will live.</span>
      </div>
      <div className="w-full sm:max-w-[320px]">
        <TomoSelect<string>
          value={value ?? ''}
          options={options}
          onValueChange={onChange}
          ariaLabel="Choose a deck"
          placeholder={loading ? 'Loading decks…' : 'Choose a deck…'}
          disabled={loading || options.length === 0}
        />
      </div>
    </div>
  )
}

// ── Preview block ─────────────────────────────────────────────────────────────

interface PreviewBlockProps {
  card:    ApiDueCard
  flipped: boolean
  onFlip:  () => void
  loading: boolean
  aiError: string | null
}

function PreviewBlock({ card, flipped, onFlip, loading, aiError }: PreviewBlockProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
          Preview · the card in practice
        </p>
        <button
          type="button"
          onClick={onFlip}
          aria-pressed={flipped}
          aria-label={flipped ? 'Show front of card' : 'Show back of card'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5',
            'font-mono text-[0.65rem] uppercase tracking-[0.16em]',
            'text-faded-sumi hover:text-sumi-ink transition-colors duration-150',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          )}
        >
          <RotateCcw size={11} strokeWidth={1.5} aria-hidden="true" />
          {flipped ? 'Show front' : 'Show back'}
        </button>
      </div>

      <SectionCard kanji="" label="" stripeTone="brand" omitTitle>
        <div
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            'px-1 pt-5 pb-6 md:px-2 md:pt-7 md:pb-8 transition-opacity duration-200 ease-out',
            loading && 'opacity-70',
          )}
        >
          {flipped ? <CardBack card={card} /> : <CardFront card={card} />}
        </div>
      </SectionCard>

      {loading && (
        <p role="status" className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
          Preparing card…
        </p>
      )}
      {aiError !== null && (
        <p role="alert" className="text-sm text-error">{aiError}</p>
      )}
    </div>
  )
}

// ── Back-of-card section ──────────────────────────────────────────────────────

interface BackOfCardSectionProps {
  word:            string
  fields:          CardFields
  updateField:     <K extends keyof CardFields>(key: K, value: CardFields[K]) => void
  isAiPath:        boolean
  regenSentence:   boolean
  regenMnemonic:   boolean
  onRegenSentence: () => void
  onRegenMnemonic: () => void
  picture:         string | null
  onClearPicture:  () => void
}

function BackOfCardSection({
  fields, updateField, isAiPath,
  regenSentence, regenMnemonic, onRegenSentence, onRegenMnemonic,
  picture, onClearPicture,
}: BackOfCardSectionProps): React.JSX.Element {
  return (
    <section aria-labelledby="back-of-card-heading" className="flex flex-col gap-7">
      <header className="flex flex-col gap-1">
        <p className="flex items-baseline gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
          <span lang="ja" aria-hidden="true" className="font-display text-base leading-none text-inari-vermillion">背</span>
          Back of card · these fields are what the learner sees after flipping
        </p>
        <h2 id="back-of-card-heading" className="font-display text-xl text-sumi-ink">
          Build the back of your card.
        </h2>
      </header>

      <Textarea
        label="Definition"
        value={fields.meaning}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateField('meaning', e.target.value)}
        placeholder="e.g. dappled sunlight filtering through leaves"
        rows={2}
        block
        hint="The English meaning the card teaches. Required."
      />

      <div className="flex flex-col gap-2">
        <Textarea
          label="Example sentence (Japanese)"
          value={fields.sentenceJa}
          onChange={(e) => updateField('sentenceJa', e.target.value)}
          placeholder="e.g. 今日は木漏れ日だから、人が少ない。"
          script="mixed"
          rows={3}
          block
        />
        {isAiPath && (
          <QuietLink
            onClick={onRegenSentence}
            tone="sumi"
            size="sm"
            ariaLabel="Generate a new sentence"
          >
            {regenSentence ? 'Generating sentence…' : 'Try another sentence'}
          </QuietLink>
        )}
      </div>

      <Textarea
        label="Translation"
        value={fields.sentenceEn}
        onChange={(e) => updateField('sentenceEn', e.target.value)}
        placeholder="e.g. There are few people today because of the dappled light."
        rows={2}
        block
      />

      <Textarea
        label="Nuance"
        value={fields.nuance}
        onChange={(e) => updateField('nuance', e.target.value)}
        placeholder="Register, connotation, when to use it instead of a near-synonym."
        rows={2}
        block
        hint="Optional. Shown as the leading tab on the back of the card."
      />

      <div className="flex flex-col gap-2">
        <Textarea
          label="Mnemonic"
          value={fields.mnemonic}
          onChange={(e) => updateField('mnemonic', e.target.value)}
          placeholder="A small story or image that anchors the meaning."
          rows={3}
          block
        />
        {isAiPath && (
          <QuietLink
            onClick={onRegenMnemonic}
            tone="sumi"
            size="sm"
            ariaLabel="Generate a new mnemonic"
          >
            {regenMnemonic ? 'Generating mnemonic…' : 'Try another mnemonic'}
          </QuietLink>
        )}
      </div>

      <ImageField picture={picture} onClear={onClearPicture} />
    </section>
  )
}

function ImageField({
  picture, onClear,
}: { picture: string | null; onClear: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-sumi-ink/85">Image</p>
      {picture !== null ? (
        <div className="flex items-start gap-3">
          <img
            src={picture}
            alt="Card illustration"
            className="max-h-[140px] w-auto rounded-md border border-soft-hairline bg-cream-inset/30 object-contain"
          />
          <QuietLink onClick={onClear} tone="sumi" size="sm" ariaLabel="Remove image">
            Remove
          </QuietLink>
        </div>
      ) : (
        <p className="text-sm text-faded-sumi">
          No image yet. You can add one after saving from card detail.
        </p>
      )}
    </div>
  )
}

// ── Advanced disclosure ───────────────────────────────────────────────────────

interface AdvancedDisclosureProps {
  fields:      CardFields
  updateField: <K extends keyof CardFields>(key: K, value: CardFields[K]) => void
}

function AdvancedDisclosure({ fields, updateField }: AdvancedDisclosureProps): React.JSX.Element {
  return (
    <MoreDisclosure label="Advanced">
      <div className="flex flex-col gap-5 pt-2">
        <Textarea
          label="Part of speech"
          value={fields.partOfSpeech}
          onChange={(e) => updateField('partOfSpeech', e.target.value)}
          rows={1}
          placeholder="e.g. noun, godan verb (う)"
          block
        />
        <Textarea
          label="Pitch accent"
          value={fields.pitchAccent}
          onChange={(e) => updateField('pitchAccent', e.target.value)}
          rows={1}
          placeholder="e.g. 0, 1, 3"
          block
        />
        <Textarea
          label="Tags"
          value={fields.tags}
          onChange={(e) => updateField('tags', e.target.value)}
          rows={1}
          placeholder="Comma-separated. Optional."
          block
        />
      </div>
    </MoreDisclosure>
  )
}

// ── Save block ────────────────────────────────────────────────────────────────

interface SaveBlockProps {
  types:         CardTypeSelection
  onTypesChange: (next: CardTypeSelection) => void
  saveLabel:     string
  canSave:       boolean
  saving:        boolean
  blockers:      string[]
  saveError:     string | null
  onSave:        () => void
}

function SaveBlock({
  types, onTypesChange, saveLabel, canSave, saving, blockers, saveError, onSave,
}: SaveBlockProps): React.JSX.Element {
  return (
    <section aria-labelledby="cards-to-save-heading" className="flex flex-col gap-5 border-t border-soft-hairline pt-8">
      <header className="flex flex-col gap-1">
        <p className="flex items-baseline gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
          <span lang="ja" aria-hidden="true" className="font-display text-base leading-none text-inari-vermillion">札</span>
          Cards to save · pick which directions to practise
        </p>
        <h2 id="cards-to-save-heading" className="font-display text-xl text-sumi-ink">
          What to save.
        </h2>
      </header>

      <div className="flex flex-col gap-1">
        <Checkbox.Row
          checked={types.comprehension}
          onChange={(next) => onTypesChange({ ...types, comprehension: next })}
          label={TYPE_LABEL.comprehension}
          description="See the word, recall the meaning."
        />
        <Checkbox.Row
          checked={types.production}
          onChange={(next) => onTypesChange({ ...types, production: next })}
          label={TYPE_LABEL.production}
          description="See the meaning, recall the word. Harder; off by default."
        />
        <Checkbox.Row
          checked={types.listening}
          onChange={(next) => onTypesChange({ ...types, listening: next })}
          label={TYPE_LABEL.listening}
          description="Hear the word, recall the meaning. Off by default."
        />
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          {blockers.length > 0 ? (
            <p className="text-sm text-faded-sumi" role="status">
              {blockers[0]}
            </p>
          ) : (
            <p className="text-sm text-faded-sumi">Ready to save.</p>
          )}
          {saveError !== null && (
            <p className="text-sm text-error mt-1" role="alert">{saveError}</p>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onSave}
          disabled={!canSave}
          loading={saving}
          className="w-full sm:w-auto sm:min-w-[180px]"
        >
          {saveLabel}
        </Button>
      </div>
    </section>
  )
}

// ── Success ───────────────────────────────────────────────────────────────────

interface SuccessBlockProps {
  count:           number
  deckName:        string
  onAddAnother:    () => void
  onReturnToToday: () => void
}

function SuccessBlock({ count, deckName, onAddAnother, onReturnToToday }: SuccessBlockProps): React.JSX.Element {
  const cardsWord = count === 1 ? 'card' : 'cards'
  return (
    <SectionCard kanji="済" label="Saved">
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.05] text-sumi-ink">
            Saved {count} {cardsWord} to {deckName}.
          </h1>
          <p className="mt-3 max-w-[55ch] text-base text-faded-sumi leading-relaxed">
            You can keep adding, open the new card, or return to Today.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" onClick={onAddAnother} autoFocus>
              Add another
            </Button>
            <Button variant="editorial" size="lg" onClick={onReturnToToday}>
              Return to Today
            </Button>
            <Link
              href="/cards"
              className="text-sm text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline"
            >
              Open cards
            </Link>
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center justify-center lg:order-last lg:pl-4">
          <Logo size={96} showWordmark={false} priority />
        </div>
      </div>
    </SectionCard>
  )
}

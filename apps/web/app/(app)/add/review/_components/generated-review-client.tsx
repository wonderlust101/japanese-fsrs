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

import type { ApiDueCard, JLPTLevel } from '@fsrs-japanese/shared-types'

import { Button }       from '@/components/ui/Button'
import { Checkbox }     from '@/components/ui/Checkbox'
import { Input }        from '@/components/ui/Input'
import { Logo }         from '@/components/ui/Logo'
import { PageHeader }   from '@/components/ui/PageHeader'
import { QuietLink }    from '@/components/ui/QuietLink'
import { SectionCard }  from '@/components/ui/SectionCard'
import { Textarea }     from '@/components/ui/Textarea'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'
import { CardBack }     from '@/components/review/session/CardBack'
import { CardFront }    from '@/components/review/session/CardFront'
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

// ── Edit state ────────────────────────────────────────────────────────────────
// Mirrors VocabularyFieldsDataSchema (packages/shared-types) so the synthetic
// preview card reads identically to a persisted one, and the save payload is
// already shaped correctly.

interface KanjiEntry { kanji: string; meaning: string; reading: string }

interface CardFields {
  word:            string
  reading:         string
  meaning:         string
  partOfSpeech:    string
  nuance:          string
  mnemonic:        string
  pitchAccent:     string
  pitchPosition:   string  // input as string; parsed to number on save
  expressionAudio: string
  frequencyRank:   string
  jlptLevel:       JLPTLevel | ''
  sentenceJa:      string
  sentenceEn:      string
  sentenceFuri:    string
  sentenceAudio:   string
  kanjiBreakdown:  KanjiEntry[]
  collocations:    string  // one per line, parsed on save
  homophones:      string
  tags:            string
  picture:         string | null
}

function makeEmptyFields(): CardFields {
  return {
    word: '', reading: '', meaning: '', partOfSpeech: '',
    nuance: '', mnemonic: '',
    pitchAccent: '', pitchPosition: '', expressionAudio: '',
    frequencyRank: '', jlptLevel: '',
    sentenceJa: '', sentenceEn: '', sentenceFuri: '', sentenceAudio: '',
    kanjiBreakdown: [],
    collocations: '', homophones: '', tags: '',
    picture: null,
  }
}

interface CardTypeSelection { comprehension: boolean; production: boolean; listening: boolean }
const DEFAULT_TYPES: CardTypeSelection = { comprehension: true, production: false, listening: false }

type ApiCardType = 'comprehension' | 'production' | 'listening'
const TYPE_LABEL: Record<ApiCardType, string> = {
  comprehension: 'Vocabulary recognition',
  production:    'Production (English → Japanese)',
  listening:     'Listening',
}

const JLPT_OPTIONS: ReadonlyArray<TomoSelectOption<string>> = [
  { value: '',            label: 'No level set'      },
  { value: 'N5',          label: 'N5'                },
  { value: 'N4',          label: 'N4'                },
  { value: 'N3',          label: 'N3'                },
  { value: 'N2',          label: 'N2'                },
  { value: 'N1',          label: 'N1'                },
  { value: 'beyond_jlpt', label: 'Beyond JLPT'       },
]

// ── Synthetic preview card ────────────────────────────────────────────────────

function buildPreviewCard(fields: CardFields): ApiDueCard {
  const example = fields.sentenceJa.trim().length > 0
    ? [{ ja: fields.sentenceJa, en: fields.sentenceEn, furigana: fields.sentenceFuri || fields.sentenceJa, audio: fields.sentenceAudio || undefined }]
    : undefined

  const fieldsData: Record<string, unknown> = {
    word:            fields.word,
    reading:         fields.reading,
    meaning:         fields.meaning,
    partOfSpeech:    fields.partOfSpeech,
    mnemonic:        fields.mnemonic,
    nuance:          fields.nuance,
    pitchAccent:     fields.pitchAccent,
    expressionAudio: fields.expressionAudio,
  }
  if (example !== undefined)              fieldsData.exampleSentences = example
  if (fields.picture !== null)            fieldsData.picture = fields.picture
  if (fields.kanjiBreakdown.length > 0)   fieldsData.kanjiBreakdown = fields.kanjiBreakdown.filter((k) => k.kanji.trim().length > 0)
  const cols = parseList(fields.collocations); if (cols.length > 0) fieldsData.collocations = cols
  const homo = parseList(fields.homophones);   if (homo.length > 0) fieldsData.homophones   = homo
  const freq = Number(fields.frequencyRank);   if (Number.isFinite(freq) && freq > 0) fieldsData.frequencyRank = freq
  const pos  = Number(fields.pitchPosition);   if (Number.isFinite(pos))              fieldsData.pitchPosition  = pos

  return {
    id:         'preview-card',
    deckId:     'preview-deck',
    cardType:   'comprehension',
    jlptLevel:  fields.jlptLevel === '' ? null : fields.jlptLevel,
    state:      0,
    due:        new Date().toISOString(),
    layoutType: 'vocabulary',
    fieldsData,
  }
}

function parseList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GeneratedReviewClient(): React.JSX.Element {
  const router         = useRouter()
  const [, startNav]   = useTransition()
  const draft          = useCaptureDraftStore((s) => s.draft)
  const captureActions = useCaptureDraftActions()

  const noDraft = draft.word.trim().length === 0
  useEffect(() => {
    if (!noDraft) return
    router.replace('/add')
  }, [noDraft, router])

  // ── Live state ────────────────────────────────────────────────────────
  const [fields,  setFields]  = useState<CardFields>(() => ({
    ...makeEmptyFields(),
    word:       draft.word,
    reading:    draft.reading,
    meaning:    draft.meaning,
    mnemonic:   draft.mnemonic,
    sentenceJa: draft.sentence,
    picture:    draft.imageDataUrl,
  }))
  const [deckId,  setDeckId]  = useState<string | null>(draft.deckId)
  const [types,   setTypes]   = useState<CardTypeSelection>(DEFAULT_TYPES)
  const [flipped, setFlipped] = useState<boolean>(false)

  const isAiPath = draft.mode === 'generate'
  const needsSeed = isAiPath && draft.reading === ''
  const [generating,    setGenerating]    = useState<boolean>(needsSeed)
  const [aiError,       setAiError]       = useState<string | null>(null)
  const [regenSentence, setRegenSentence] = useState<boolean>(false)
  const [regenMnemonic, setRegenMnemonic] = useState<boolean>(false)

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

  // ── Seed once on mount in AI path ─────────────────────────────────────
  useEffect(() => {
    if (!generating) return
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
          mnemonic:     data.mnemonic    ?? prev.mnemonic,
          pitchAccent:  data.pitchAccent ?? prev.pitchAccent,
          sentenceJa:   prev.sentenceJa.length > 0 ? prev.sentenceJa : first?.ja       ?? prev.sentenceJa,
          sentenceEn:   prev.sentenceEn.length > 0 ? prev.sentenceEn : first?.en       ?? prev.sentenceEn,
          sentenceFuri: prev.sentenceFuri.length > 0 ? prev.sentenceFuri : first?.furigana ?? prev.sentenceFuri,
          kanjiBreakdown: prev.kanjiBreakdown.length > 0
            ? prev.kanjiBreakdown
            : (data.kanjiBreakdown ?? []).map((k) => ({ kanji: k.kanji, meaning: k.meaning, reading: '' })),
        }))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAiError(err instanceof Error ? err.message : 'Generation failed.')
      })
      .finally(() => { if (!cancelled) setGenerating(false) })
    return () => { cancelled = true }
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────
  const previewCard = useMemo(() => buildPreviewCard(fields), [fields])

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
    const sentence = fields.sentenceJa.trim()
    const word     = fields.word.trim()
    if (sentence.length > 0 && word.length > 0 && !sentence.includes(word)) {
      list.push('Your sentence doesn’t include the word — fix the sentence or word to save.')
    }
    return list
  }, [fields.meaning, fields.sentenceJa, fields.word, deckId, selectedTypes])

  const canSave = !generating && !saving && blockers.length === 0

  const updateField = useCallback(
    <K extends keyof CardFields>(key: K, value: CardFields[K]): void => {
      setFields((prev) => ({ ...prev, [key]: value }))
    }, [])

  // ── Regenerate ────────────────────────────────────────────────────────
  void generateSentencesAction  // reserved for post-save iteration

  const onRegenSentence = useCallback((): void => {
    if (regenSentence || generating) return
    setRegenSentence(true); setAiError(null)
    void generateCardPreviewAction(fields.word.trim())
      .then((data) => {
        const first = data.exampleSentences?.[0]
        if (first !== undefined) {
          setFields((prev) => ({ ...prev, sentenceJa: first.ja, sentenceEn: first.en, sentenceFuri: first.furigana }))
        }
      })
      .catch((err: unknown) => setAiError(err instanceof Error ? err.message : 'Regeneration failed.'))
      .finally(() => setRegenSentence(false))
  }, [fields.word, regenSentence, generating])

  const onRegenMnemonic = useCallback((): void => {
    if (regenMnemonic || generating) return
    setRegenMnemonic(true); setAiError(null)
    void generateCardPreviewAction(fields.word.trim())
      .then((data) => {
        if (data.mnemonic !== undefined && data.mnemonic.length > 0) {
          setFields((prev) => ({ ...prev, mnemonic: data.mnemonic ?? prev.mnemonic }))
        }
      })
      .catch((err: unknown) => setAiError(err instanceof Error ? err.message : 'Regeneration failed.'))
      .finally(() => setRegenMnemonic(false))
  }, [fields.word, regenMnemonic, generating])

  // ── Save ──────────────────────────────────────────────────────────────
  const onSave = useCallback(async (): Promise<void> => {
    if (!canSave || deckId === null) return
    setSaving(true); setSaveError(null)
    try {
      const preview = buildPreviewCard(fields)
      const fieldsData = preview.fieldsData as Record<string, unknown>
      const tagList = parseList(fields.tags)
      for (const cardType of selectedTypes) {
        await saveCardAction(deckId, {
          mode: 'manual',
          fieldsData,
          cardType,
          layoutType: 'vocabulary',
          ...(tagList.length > 0 ? { tags: tagList } : {}),
          ...(fields.jlptLevel !== '' ? { jlptLevel: fields.jlptLevel } : {}),
        })
      }
      setSaved({ count: selectedTypes.length, deckName: deckName ?? 'your deck' })
      captureActions.reset()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the card.')
    } finally {
      setSaving(false)
    }
  }, [canSave, deckId, fields, selectedTypes, deckName, captureActions])

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'Enter' || !canSave) return
      e.preventDefault()
      void onSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canSave, onSave])

  // ── Renders ───────────────────────────────────────────────────────────
  if (noDraft) return <div className="px-6 pt-16 text-sm text-faded-sumi" role="status">Loading…</div>

  if (saved !== null) {
    return (
      <Frame>
        <SuccessBlock
          count={saved.count}
          deckName={saved.deckName}
          onAddAnother={() => startNav(() => router.push('/add'))}
          onReturnToToday={() => startNav(() => router.push('/today'))}
        />
      </Frame>
    )
  }

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
      <PageHeader kanji={header.kanji} label={header.label} title={header.title} subtitle={header.subtitle} />

      <DeckRow options={deckOptions} value={deckId} onChange={setDeckId} loading={decksQuery.isLoading} />

      {/* Two-column desktop: field SectionCards left, sticky preview right. */}
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        {/* Left: field SectionCards */}
        <div className="lg:col-span-7 flex flex-col gap-6 lg:gap-7">
          <SectionEyebrow />

          <SectionCard kanji="義" label="Definition" stripeTone="brand">
            <div className="flex flex-col gap-5 pt-1">
              <Textarea
                label="Meaning"
                value={fields.meaning}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateField('meaning', e.target.value)}
                placeholder="e.g. dappled sunlight filtering through leaves"
                rows={2}
                block
                hint="The English meaning the card teaches. Required."
              />
              <Input
                label="Part of speech"
                value={fields.partOfSpeech}
                onChange={(e) => updateField('partOfSpeech', e.target.value)}
                placeholder="e.g. noun"
              />
            </div>
          </SectionCard>

          <SectionCard kanji="例" label="Example sentence">
            <div className="flex flex-col gap-5 pt-1">
              <Textarea
                label="Japanese"
                value={fields.sentenceJa}
                onChange={(e) => updateField('sentenceJa', e.target.value)}
                placeholder="今日は木漏れ日だから、人が少ない。"
                script="mixed"
                rows={3}
                block
              />
              <Textarea
                label="Furigana"
                value={fields.sentenceFuri}
                onChange={(e) => updateField('sentenceFuri', e.target.value)}
                placeholder="Sentence with kana over kanji."
                script="kana"
                rows={2}
                block
                hint="Optional. Falls back to the plain sentence if empty."
              />
              <Textarea
                label="Translation"
                value={fields.sentenceEn}
                onChange={(e) => updateField('sentenceEn', e.target.value)}
                placeholder="There are few people today because of the dappled light."
                rows={2}
                block
              />
              <Input
                label="Sentence audio URL"
                value={fields.sentenceAudio}
                onChange={(e) => updateField('sentenceAudio', e.target.value)}
                placeholder="Optional. Plays under the sentence on the back."
              />
              {isAiPath && (
                <QuietLink onClick={onRegenSentence} tone="sumi" size="sm" ariaLabel="Generate a new sentence">
                  {regenSentence ? 'Generating sentence…' : 'Try another sentence'}
                </QuietLink>
              )}
            </div>
          </SectionCard>

          <SectionCard kanji="音" label="Pronunciation">
            <div className="grid gap-5 pt-1 sm:grid-cols-2">
              <Input
                label="Reading"
                value={fields.reading}
                onChange={(e) => updateField('reading', e.target.value)}
                placeholder="こもれび"
                script="kana"
              />
              <Input
                label="Pitch accent"
                value={fields.pitchAccent}
                onChange={(e) => updateField('pitchAccent', e.target.value)}
                placeholder="e.g. heiban / atamadaka"
              />
              <Input
                label="Pitch position"
                value={fields.pitchPosition}
                onChange={(e) => updateField('pitchPosition', e.target.value)}
                placeholder="e.g. 0, 1, 3"
                inputMode="numeric"
              />
              <Input
                label="Expression audio URL"
                value={fields.expressionAudio}
                onChange={(e) => updateField('expressionAudio', e.target.value)}
                placeholder="Optional."
              />
            </div>
          </SectionCard>

          <SectionCard kanji="解" label="Teaching notes">
            <div className="flex flex-col gap-5 pt-1">
              <Textarea
                label="Nuance"
                value={fields.nuance}
                onChange={(e) => updateField('nuance', e.target.value)}
                placeholder="Register, connotation, when to use it instead of a near-synonym."
                rows={3}
                block
                hint="Optional. Shown as the leading tab on the back of the card."
              />
              <Textarea
                label="Mnemonic"
                value={fields.mnemonic}
                onChange={(e) => updateField('mnemonic', e.target.value)}
                placeholder="A small story or image that anchors the meaning."
                rows={3}
                block
              />
              {isAiPath && (
                <QuietLink onClick={onRegenMnemonic} tone="sumi" size="sm" ariaLabel="Generate a new mnemonic">
                  {regenMnemonic ? 'Generating mnemonic…' : 'Try another mnemonic'}
                </QuietLink>
              )}
            </div>
          </SectionCard>

          <SectionCard kanji="字" label="Kanji breakdown">
            <KanjiEditor
              entries={fields.kanjiBreakdown}
              onChange={(next) => updateField('kanjiBreakdown', next)}
            />
          </SectionCard>

          <SectionCard kanji="連" label="Related words">
            <div className="flex flex-col gap-5 pt-1">
              <Textarea
                label="Collocations"
                value={fields.collocations}
                onChange={(e) => updateField('collocations', e.target.value)}
                placeholder={'One per line\ne.g. 木漏れ日が差す'}
                rows={3}
                block
                script="mixed"
              />
              <Textarea
                label="Homophones"
                value={fields.homophones}
                onChange={(e) => updateField('homophones', e.target.value)}
                placeholder={'One per line'}
                rows={3}
                block
                script="mixed"
              />
            </div>
          </SectionCard>

          <SectionCard kanji="他" label="Advanced">
            <div className="grid gap-5 pt-1 sm:grid-cols-2">
              <Input
                label="Frequency rank"
                value={fields.frequencyRank}
                onChange={(e) => updateField('frequencyRank', e.target.value)}
                placeholder="e.g. 2400"
                inputMode="numeric"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-sumi-ink/85">JLPT level</span>
                <TomoSelect<string>
                  value={fields.jlptLevel}
                  options={JLPT_OPTIONS}
                  onValueChange={(v) => updateField('jlptLevel', (v === '' ? '' : v) as JLPTLevel | '')}
                  ariaLabel="JLPT level"
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Tags"
                  value={fields.tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                  placeholder="One per line"
                  rows={2}
                  block
                />
              </div>
              <div className="sm:col-span-2">
                <ImageField picture={fields.picture} onClear={() => updateField('picture', null)} />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right: sticky preview */}
        <aside className="lg:col-span-5 lg:sticky lg:top-10 lg:self-start flex flex-col gap-4">
          <PreviewBlock
            card={previewCard}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            loading={generating}
            aiError={aiError}
          />
        </aside>
      </div>

      {/* Card-type chooser + Save, anchored beneath the grid */}
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

// ── Frame ─────────────────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 content-center gap-y-8 px-6 pt-8 md:px-12 md:pt-10 lg:gap-y-10 lg:px-16 lg:pt-12">
        {children}
      </div>
    </div>
  )
}

// ── Section eyebrow (introduces the back-of-card field stack) ────────────────

function SectionEyebrow(): React.JSX.Element {
  return (
    <header className="flex flex-col gap-1">
      <p className="flex items-baseline gap-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span lang="ja" aria-hidden="true" className="font-display text-base leading-none text-inari-vermillion">背</span>
        Back of card · these fields fill what the learner sees after flipping
      </p>
      <h2 className="font-display text-xl text-sumi-ink">Build the back of your card.</h2>
    </header>
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
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">Deck</span>
        <span className="text-sm text-faded-sumi">Where this card will live.</span>
      </div>
      <div className="w-full sm:max-w-[360px]">
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
      {aiError !== null && <p role="alert" className="text-sm text-error">{aiError}</p>}
    </div>
  )
}

// ── Kanji breakdown editor ────────────────────────────────────────────────────

interface KanjiEditorProps {
  entries:  KanjiEntry[]
  onChange: (next: KanjiEntry[]) => void
}

function KanjiEditor({ entries, onChange }: KanjiEditorProps): React.JSX.Element {
  const update = (i: number, patch: Partial<KanjiEntry>): void => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e)
    onChange(next)
  }
  const remove = (i: number): void => onChange(entries.filter((_, idx) => idx !== i))
  const add    = (): void => onChange([...entries, { kanji: '', meaning: '', reading: '' }])

  return (
    <div className="flex flex-col gap-4 pt-1">
      {entries.length === 0 && (
        <p className="text-sm text-faded-sumi">No kanji listed. Add one if it helps learners see the parts.</p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Input
            label="Kanji"
            value={entry.kanji}
            onChange={(e) => update(i, { kanji: e.target.value })}
            script="kanji"
            placeholder="木"
          />
          <Input
            label="Meaning"
            value={entry.meaning}
            onChange={(e) => update(i, { meaning: e.target.value })}
            placeholder="tree"
          />
          <Input
            label="Reading"
            value={entry.reading}
            onChange={(e) => update(i, { reading: e.target.value })}
            script="kana"
            placeholder="き / モク"
          />
          <QuietLink onClick={() => remove(i)} tone="sumi" size="sm" ariaLabel={`Remove kanji ${entry.kanji || i + 1}`}>
            Remove
          </QuietLink>
        </div>
      ))}
      <div>
        <QuietLink onClick={add} tone="brand" size="sm" ariaLabel="Add kanji entry">+ Add kanji</QuietLink>
      </div>
    </div>
  )
}

// ── Image field ───────────────────────────────────────────────────────────────

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
          <QuietLink onClick={onClear} tone="sumi" size="sm" ariaLabel="Remove image">Remove</QuietLink>
        </div>
      ) : (
        <p className="text-sm text-faded-sumi">No image yet. You can add one after saving from card detail.</p>
      )}
    </div>
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
    <SectionCard kanji="札" label="Cards to save" description="Pick which directions to practise.">
      <div className="flex flex-col gap-5 pt-1">
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

        <div className="flex flex-col gap-3 border-t border-soft-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            {blockers.length > 0 ? (
              <p className="text-sm text-faded-sumi" role="status">{blockers[0]}</p>
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
            className="w-full sm:w-auto sm:min-w-[200px]"
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </SectionCard>
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

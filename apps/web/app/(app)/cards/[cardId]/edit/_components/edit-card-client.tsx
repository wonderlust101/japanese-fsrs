'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { IconUndo, IconChevronDown, IconEdit } from '@/components/icons/chrome-marks'

import { useUnsavedChangesWarning } from '@/lib/hooks/useUnsavedChangesWarning'

import {
  getVocabularyFields,
  getWordFields,
  partOfSpeechEnum,
  pitchPatternEnum,
  type ApiCard,
  type ApiDueCard,
  type JLPTLevel,
} from '@fsrs-japanese/shared-types'

import { Button }       from '@/components/ui/Button'
import { Input }        from '@/components/ui/Input'
import { PageFrame }    from '@/app/(app)/_components/page-frame'
import { PageHeader }   from '@/components/ui/PageHeader'
import { QuietLink }    from '@/components/ui/QuietLink'
import { SectionCard }  from '@/components/ui/SectionCard'
import { Textarea }     from '@/components/ui/Textarea'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'
import { CardBack }     from '@/components/review/session/CardBack'
import { CardFront }    from '@/components/review/session/CardFront'
import {
  generateSentencesAction,
  generateMnemonicAction,
  moveCardAction,
  updateCardAction,
} from '@/lib/actions/cards.actions'
import { cn } from '@/lib/utils'

// ── Edit state ────────────────────────────────────────────────────────────────
// Mirrors VocabularyFieldsDataSchema (packages/shared-types) so the synthetic
// preview card reads identically to a persisted one, and the update payload is
// already shaped correctly. This is the editing twin of /add/review: the form
// is hydrated from a saved card rather than from a capture draft, and saving
// PATCHes the card in place instead of inserting a new one.

// `radical` is AI-authored and not surfaced as an input (matching /add/review),
// but it must round-trip through the editor or every save strips it from the
// card's kanji breakdown — `KanjiBreakdownSchema` carries it and the v4 review
// surface renders it.
// `id` is a client-only stable key for the editor lists — never persisted
// (buildFieldsData strips it). It keeps row identity (focus / IME composition /
// open state) pinned to the entry, not its index, across add/remove.
interface KanjiEntry { id: string; kanji: string; radical: string; meaning: string; reading: string }

// One authored example sentence. Mirrors `ExampleSentenceSchema`
// (packages/shared-types). A card holds an ordered list; the review back
// shows one per review (rotated stable-randomly), so list order is the
// author's browsing order, not a display priority.
interface SentenceEntry { id: string; ja: string; en: string; furigana: string }

// Cap on authored example sentences. Keeps the editor bounded and storage
// sane; the rotation cycles through whatever is present.
const MAX_SENTENCES = 10

// How many sentences one "Generate examples" click fetches (clamped to the
// remaining headroom under MAX_SENTENCES).
const SENTENCE_BATCH = 3

// Stable per-row id for the editor list keys. A monotonic module counter is
// sufficient — keys only need to be unique and stable within a session — and
// avoids a crypto dependency. These ids are client-only and never persisted.
let rowKeySeq = 0
const nextRowKey = (): string => `row-${rowKeySeq++}`

interface CardFields {
  deckId:          string
  word:            string
  reading:         string
  meaning:         string
  partOfSpeech:    string
  nuance:          string
  mnemonic:        string
  pitchAccent:     string
  pitchPosition:   string  // input as string; parsed to number on save
  frequencyRank:   string
  jlptLevel:       JLPTLevel | ''
  sentences:       SentenceEntry[]
  kanjiBreakdown:  KanjiEntry[]
  picture:         string | null
}

// Hydrate the editable field set from a persisted card. The inverse of
// `buildFieldsData` below — numeric fields collapse to strings for the text
// inputs, and the JLPT null sentinel becomes the empty-string select value.
function fieldsFromCard(card: ApiCard): CardFields {
  const wf = getWordFields(card)
  const vf = getVocabularyFields(card)
  return {
    // Non-null in practice — the page redirects when deckId is null.
    deckId:        card.deckId ?? '',
    word:          wf?.word    ?? '',
    reading:       wf?.reading ?? '',
    meaning:       wf?.meaning ?? '',
    partOfSpeech:  wf?.partOfSpeech ?? '',
    nuance:        wf?.nuance      ?? '',
    mnemonic:      wf?.mnemonic    ?? '',
    pitchAccent:   vf?.pitchAccent ?? '',
    pitchPosition: wf?.pitchPosition != null ? String(wf.pitchPosition) : '',
    frequencyRank: wf?.frequencyRank != null ? String(wf.frequencyRank) : '',
    jlptLevel:     card.jlptLevel ?? '',
    sentences: (vf?.exampleSentences ?? []).map((s) => ({ id: nextRowKey(), ja: s.ja, en: s.en, furigana: s.furigana })),
    kanjiBreakdown: (vf?.kanjiBreakdown ?? []).map((k) => ({ id: nextRowKey(), kanji: k.kanji, radical: k.radical ?? '', meaning: k.meaning, reading: k.reading })),
    picture: wf?.picture ?? null,
  }
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

// Sourced from the shared enums so the selector, the AI prompt, and the
// structured-output validation stay in lockstep.
const POS_OPTIONS: ReadonlyArray<TomoSelectOption<string>> = [
  { value: '', label: 'Not set' },
  ...partOfSpeechEnum.options.map((v) => ({ value: v, label: v })),
]

const PITCH_LABELS: Record<string, string> = {
  heiban:    'Heiban (平板)',
  atamadaka: 'Atamadaka (頭高)',
  nakadaka:  'Nakadaka (中高)',
  odaka:     'Odaka (尾高)',
}
const PITCH_OPTIONS: ReadonlyArray<TomoSelectOption<string>> = [
  { value: '', label: 'Not set' },
  ...pitchPatternEnum.options.map((v) => ({ value: v, label: PITCH_LABELS[v] ?? v })),
]

// ── Synthetic preview card ────────────────────────────────────────────────────

// Shared by the synthetic preview card and the update payload — keeps
// "what we send to the backend" and "what the preview renders" in lockstep.
function buildFieldsData(fields: CardFields): Record<string, unknown> {
  // Each authored sentence with a non-empty Japanese line becomes an
  // exampleSentences entry; furigana falls back to the plain sentence.
  const examples = fields.sentences
    .filter((s) => s.ja.trim().length > 0)
    .map((s) => ({ ja: s.ja, en: s.en, furigana: s.furigana || s.ja }))

  const fieldsData: Record<string, unknown> = {
    word:         fields.word,
    reading:      fields.reading,
    meaning:      fields.meaning,
    partOfSpeech: fields.partOfSpeech,
    mnemonic:     fields.mnemonic,
    nuance:       fields.nuance,
    pitchAccent:  fields.pitchAccent,
  }
  if (examples.length > 0)                fieldsData.exampleSentences = examples
  if (fields.picture !== null)            fieldsData.picture = fields.picture
  if (fields.kanjiBreakdown.length > 0)   fieldsData.kanjiBreakdown = fields.kanjiBreakdown.filter((k) => k.kanji.trim().length > 0).map((k) => ({ kanji: k.kanji, radical: k.radical, meaning: k.meaning, reading: k.reading }))
  const freq = Number(fields.frequencyRank);   if (Number.isFinite(freq) && freq > 0) fieldsData.frequencyRank = freq
  const pos  = Number(fields.pitchPosition);   if (Number.isFinite(pos))              fieldsData.pitchPosition  = pos

  return fieldsData
}

function buildPreviewCard(fields: CardFields, layoutType: ApiCard['layoutType']): ApiDueCard {
  // The `ApiDueCard.fieldsData` type is the tight `FieldsData` union; the
  // unknown-cast is safe because `buildFieldsData` always populates
  // word/reading/meaning — the runtime shape matches the WordFields arm of
  // the union for both vocabulary and grammar layouts.
  return {
    id:         'preview-card',
    deckId:     'preview-deck',
    jlptLevel:  fields.jlptLevel === '' ? null : fields.jlptLevel,
    state:      0,
    due:        new Date().toISOString(),
    layoutType,
    fieldsData: buildFieldsData(fields) as unknown as ApiDueCard['fieldsData'],
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface DeckOption { id: string; name: string }

interface EditCardClientProps {
  card:     ApiCard
  deckName: string
  /** The user's active decks (valid move targets), including the card's
   *  current deck. Lets the author relocate the card while editing. */
  decks:    DeckOption[]
}

export function EditCardClient({ card, deckName, decks }: EditCardClientProps): React.JSX.Element {
  const router = useRouter()

  // ── Live state — seeded once from the persisted card ──────────────────
  const [fields,  setFields]  = useState<CardFields>(() => fieldsFromCard(card))
  const [flipped, setFlipped] = useState<boolean>(false)
  // Which example sentence the preview pins (the review back rotates; the
  // author pages through them here). Clamped against the live count at render.
  const [previewSentenceIdx, setPreviewSentenceIdx] = useState<number>(0)

  // AI regeneration is always available while editing — the card is already
  // saved, so the dedicated cardId-keyed endpoints can look it up server-side
  // to extract its `word` and existing context.
  const aiEnabled = fields.word.trim().length > 0
  const [aiError,       setAiError]       = useState<string | null>(null)
  // Batch sentence generation: `pendingCount` drives the skeleton placeholder
  // rows so the author sees how many sentences are inbound.
  const [generatingBatch, setGeneratingBatch] = useState<boolean>(false)
  const [pendingCount,    setPendingCount]    = useState<number>(0)
  // Id of the single row being regenerated in place (null = none).
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [regenMnemonic,   setRegenMnemonic]   = useState<boolean>(false)

  const [saving,    setSaving]    = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Flips true the first time the user attempts a save while a blocker is
  // still unmet. Until then, unmet requirements read as calm guidance
  // (faded-sumi); after a blocked attempt they escalate to error tone. Reset
  // on the next field edit so the form returns to calm once the user
  // re-engages — the same "status reflects current truth" pattern used below.
  const [attemptedSave, setAttemptedSave] = useState<boolean>(false)
  // Flips true on the first user edit (all field/sentence/kanji changes route
  // through updateField). Drives the unsaved-changes guard below.
  const [dirty, setDirty] = useState<boolean>(false)

  // ── Derived ───────────────────────────────────────────────────────────
  const previewCard = useMemo(() => buildPreviewCard(fields, card.layoutType), [fields, card.layoutType])

  // Preview pager: indexes the same non-empty sentences `buildFieldsData`
  // emits, so the pinned index lines up with the preview card's array.
  const sentenceCount = useMemo(
    () => fields.sentences.filter((s) => s.ja.trim().length > 0).length,
    [fields.sentences],
  )
  const clampedPreviewIdx = sentenceCount > 0 ? Math.min(previewSentenceIdx, sentenceCount - 1) : 0

  // Hard save gate: a card must keep a definition. (Deck placement is fixed
  // while editing — moving a card lives in the card menu, not here — so the
  // deck is shown as read-only context and never gates the save.)
  const blockers = useMemo<string[]>(() => {
    const list: string[] = []
    if (fields.meaning.trim().length === 0) list.push('Keep a definition to save.')
    return list
  }, [fields.meaning])

  // The Save button stays clickable whenever the form isn't mid-flight, even
  // with blockers present: a disabled button can't explain itself, so a
  // blocked click is what surfaces the (now escalated) requirement copy.
  const busy = saving

  // Warn before a hard navigation / tab close drops unsaved edits. Suppressed
  // while a save is in flight (on success the page navigates away and unmounts
  // this guard). Soft in-app navigation isn't guarded (App Router limitation).
  useUnsavedChangesWarning(dirty && !saving)

  const updateField = useCallback(
    <K extends keyof CardFields>(key: K, value: CardFields[K]): void => {
      setDirty(true)
      setFields((prev) => ({ ...prev, [key]: value }))
      // Re-engaging clears a prior blocked-save escalation, so unmet
      // requirements fall back to calm guidance rather than staying red.
      setAttemptedSave((prev) => (prev ? false : prev))
    }, [])

  // ── Regenerate ────────────────────────────────────────────────────────
  //
  // The card is saved, so regeneration routes through the cheaper cardId-keyed
  // endpoints (`generateSentencesAction`, `generateMnemonicAction`) which look
  // the card up server-side to extract `word` and context.

  // Snapshot of the current non-empty Japanese lines. Sent as `avoid` so the
  // server prompts for fresh, distinct sentences (and caches per-context), and
  // reused to dedupe what comes back.
  const existingJa = useCallback(
    (): string[] => fields.sentences.map((s) => s.ja.trim()).filter((s) => s.length > 0),
    [fields.sentences],
  )

  // Generate a batch in one call and append the new, deduped sentences (up to
  // the cap), keyed by the saved card.
  const onGenerateExamples = useCallback((): void => {
    if (generatingBatch) return
    const remaining = MAX_SENTENCES - fields.sentences.length
    if (remaining <= 0) return

    const want   = Math.min(SENTENCE_BATCH, remaining)
    const avoid  = existingJa()
    setGeneratingBatch(true); setPendingCount(want); setAiError(null)

    void generateSentencesAction(card.id, want, avoid)
      .then((data) => {
        const seen  = new Set(avoid)
        const fresh: SentenceEntry[] = []
        for (const s of data.sentences) {
          const ja = s.ja.trim()
          if (ja.length === 0 || seen.has(ja)) continue
          seen.add(ja)
          fresh.push({ id: nextRowKey(), ja: s.ja, en: s.en, furigana: s.furigana })
        }
        if (fresh.length > 0) {
          setFields((prev) => ({
            ...prev,
            sentences: [...prev.sentences, ...fresh].slice(0, MAX_SENTENCES),
          }))
        }
      })
      .catch(() => setAiError("Couldn't generate sentences. Please try again."))
      .finally(() => { setGeneratingBatch(false); setPendingCount(0) })
  }, [generatingBatch, fields.sentences, existingJa, card.id])

  // Replace a single sentence in place with a fresh AI generation, telling the
  // model to avoid every current sentence so it doesn't echo what's there.
  const onRegenerateRow = useCallback((id: string): void => {
    if (regeneratingId !== null) return

    const avoid = existingJa()
    setRegeneratingId(id); setAiError(null)

    void generateSentencesAction(card.id, 1, avoid)
      .then((data) => {
        const first = data.sentences[0]
        if (first !== undefined) {
          // Match by id and spread the old entry so the row keeps its key.
          setFields((prev) => ({
            ...prev,
            sentences: prev.sentences.map((s) =>
              s.id === id ? { ...s, ja: first.ja, en: first.en, furigana: first.furigana } : s),
          }))
        }
      })
      .catch(() => setAiError("Couldn't regenerate that sentence. Please try again."))
      .finally(() => setRegeneratingId(null))
  }, [regeneratingId, existingJa, card.id])

  const onRegenMnemonic = useCallback((): void => {
    if (regenMnemonic) return
    setRegenMnemonic(true); setAiError(null)

    void generateMnemonicAction(card.id)
      .then((data) => {
        if (data.mnemonic.length > 0) {
          setFields((prev) => ({ ...prev, mnemonic: data.mnemonic }))
        }
      })
      .catch(() => setAiError("Couldn't regenerate the mnemonic. Please try again."))
      .finally(() => setRegenMnemonic(false))
  }, [regenMnemonic, card.id])

  // ── Save / cancel ───────────────────────────────────────────────────────
  //
  // A blocked attempt (missing definition) flips `attemptedSave` so the
  // requirement copy escalates from calm guidance to error tone, then bails. A
  // clean attempt PATCHes via updateCardAction (If-Match: card.version for
  // optimistic concurrency) and returns to the page the user came from.
  // router.back() is a no-op when there's no in-app history (deep-link entry,
  // reload). Fall back to the card detail so Save/Cancel always lands somewhere.
  const goBackOrDetail = useCallback((): void => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(`/cards/${card.id}`)
  }, [router, card.id])

  const onSave = useCallback(async (): Promise<void> => {
    if (saving) return
    if (blockers.length > 0) { setAttemptedSave(true); return }
    setSaving(true); setSaveError(null)
    try {
      await updateCardAction(card.id, card.version, {
        fieldsData: buildFieldsData(fields),
        layoutType: card.layoutType,
        jlptLevel:  fields.jlptLevel === '' ? null : fields.jlptLevel,
      })
      // Deck change rides a separate endpoint (POST /cards/:id/move), not the
      // content PATCH. It runs *after* the PATCH on purpose: the move bumps the
      // row version, so moving first would make the PATCH's If-Match stale and
      // 412. Move is version-agnostic (idempotency-key only), so this order is
      // safe. If the move fails, the content edit is already persisted and the
      // error surfaces for a retry — no edits are lost.
      if (fields.deckId !== '' && fields.deckId !== card.deckId) {
        await moveCardAction(card.id, fields.deckId)
      }
      // The destination (card detail / cards browser) is server-rendered and
      // sits in Next's client Router Cache. `cache: 'no-store'` only governs
      // the server-side fetch — without invalidating the Router Cache, back()
      // replays the pre-edit render and the save looks like a no-op. Refresh
      // first so the cache is stale before the back-navigation resolves it.
      router.refresh()
      goBackOrDetail()
    } catch {
      setSaveError("Couldn't save your changes. Please try again.")
      setSaving(false)
    }
    // No finally → setSaving(false): on success we navigate away, so leaving
    // the button in its loading state avoids a flash of the enabled form
    // during the route transition.
  }, [saving, blockers, fields, card.id, card.version, card.deckId, card.layoutType, router, goBackOrDetail])

  const onCancel = useCallback((): void => {
    if (saving) return
    goBackOrDetail()
  }, [saving, goBackOrDetail])

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'Enter') return
      e.preventDefault()
      void onSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSave])

  // ── Render ──────────────────────────────────────────────────────────────
  const header = {
    kanji:    '筆',
    label:    'Edit card',
    title:    'Update what’s here.',
    subtitle: 'Change anything below. Your edits replace the current card content when you save.',
  }

  return (
    <Frame>
      <PageHeader kanji={header.kanji} label={header.label} title={header.title} subtitle={header.subtitle} />

      {/* Two-column desktop (6/6): field SectionCards left, preview + Save right.
          items-start at every breakpoint: below lg the single-column grid would
          otherwise stretch the left-column track to its (definite) height, and the
          left column's h-full SectionCards would split that into equal slabs and
          clip taller sections via SectionCard's overflow-hidden. grid-cols-1 at
          the base breakpoint stops the implicit auto column from growing to a
          textarea's intrinsic min-content width and pushing the column past the
          viewport when an editor section expands. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10">
        {/* Left: field SectionCards */}
        <div className="lg:col-span-6 flex flex-col gap-6 lg:gap-7">
          <DeckPickerCard
            decks={decks}
            value={fields.deckId}
            currentDeckId={card.deckId ?? ''}
            deckName={deckName}
            onChange={(v) => updateField('deckId', v)}
          />

          <SectionCard kanji="義" label="Definition" rightContent={<SectionRequirement />}>
            <div className="flex flex-col gap-6 pt-1">
              <Textarea
                label="Meaning"
                value={fields.meaning}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateField('meaning', e.target.value)}
                placeholder="e.g. dappled sunlight filtering through leaves"
                rows={2}
                block
                hint="The English meaning the card teaches."
              />
              <div className="flex flex-col gap-2">
                <span id="pos-label" className="text-sm font-medium text-sumi-ink/85">
                  Part of speech <span className="font-normal text-faded-sumi">· Optional</span>
                </span>
                <TomoSelect<string>
                  value={fields.partOfSpeech}
                  options={POS_OPTIONS}
                  onValueChange={(v) => updateField('partOfSpeech', v)}
                  ariaLabelledBy="pos-label"
                />
              </div>
            </div>
          </SectionCard>

          <CollapsibleSection
            kanji="例"
            label="Example sentences"
            description="The learner sees one per review, rotated across your set."
            {...(fields.sentences.length > 0 ? { count: fields.sentences.length } : {})}
          >
            <div className="flex flex-col gap-6 pt-1">
              <SentenceEditor
                entries={fields.sentences}
                word={fields.word}
                onChange={(next) => updateField('sentences', next)}
                regeneratingId={regeneratingId}
                pendingCount={pendingCount}
                {...(aiEnabled ? { onRegenerateRow } : {})}
              />
              {aiEnabled && fields.sentences.length < MAX_SENTENCES && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onGenerateExamples}
                    loading={generatingBatch}
                    leadingIcon={<IconEdit className="h-4 w-4" />}
                    aria-label="Generate example sentences"
                  >
                    {generatingBatch ? 'Generating…' : `Generate ${Math.min(SENTENCE_BATCH, MAX_SENTENCES - fields.sentences.length)} examples`}
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            kanji="音"
            label="Pronunciation"
            description="Reading in kana, plus pitch accent for how the word sounds."
            hasContent={fields.reading.trim().length > 0 || fields.pitchAccent.trim().length > 0 || fields.pitchPosition.trim().length > 0}
          >
            <div className="grid gap-6 pt-1 sm:grid-cols-2">
              <Input
                label="Reading"
                value={fields.reading}
                onChange={(e) => updateField('reading', e.target.value)}
                placeholder="こもれび"
                script="kana"
              />
              <div className="flex flex-col gap-2">
                <span id="pitch-label" className="text-sm font-medium text-sumi-ink/85">Pitch accent</span>
                <TomoSelect<string>
                  value={fields.pitchAccent}
                  options={PITCH_OPTIONS}
                  onValueChange={(v) => updateField('pitchAccent', v)}
                  ariaLabelledBy="pitch-label"
                />
              </div>
              <Input
                label="Pitch position"
                value={fields.pitchPosition}
                onChange={(e) => updateField('pitchPosition', e.target.value)}
                placeholder="e.g. 0, 1, 3"
                inputMode="numeric"
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            kanji="解"
            label="Teaching notes"
            description="Usage nuance and a memory aid, shown on the back of the card."
            hasContent={fields.nuance.trim().length > 0 || fields.mnemonic.trim().length > 0}
          >
            <div className="flex flex-col gap-6 pt-1">
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
                hint="Optional. A memory aid shown on the back of the card."
              />
              {aiEnabled && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onRegenMnemonic}
                    loading={regenMnemonic}
                    leadingIcon={<IconEdit className="h-4 w-4" />}
                    aria-label="Generate a new mnemonic"
                  >
                    {regenMnemonic ? 'Generating…' : 'Try another mnemonic'}
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            kanji="字"
            label="Kanji breakdown"
            description="Split the word into its kanji, each with a meaning and reading."
            {...(fields.kanjiBreakdown.length > 0 ? { count: fields.kanjiBreakdown.length } : {})}
          >
            <KanjiEditor
              entries={fields.kanjiBreakdown}
              onChange={(next) => updateField('kanjiBreakdown', next)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            kanji="他"
            label="Advanced"
            description="Frequency rank and JLPT level."
            hasContent={fields.frequencyRank.trim().length > 0 || fields.jlptLevel !== ''}
          >
            <div className="grid gap-6 pt-1 sm:grid-cols-2">
              <Input
                label="Frequency rank"
                value={fields.frequencyRank}
                onChange={(e) => updateField('frequencyRank', e.target.value)}
                placeholder="e.g. 2400"
                inputMode="numeric"
              />
              <div className="flex flex-col gap-2">
                <span id="jlpt-label" className="text-sm font-medium text-sumi-ink/85">JLPT level</span>
                <TomoSelect<string>
                  value={fields.jlptLevel}
                  options={JLPT_OPTIONS}
                  onValueChange={(v) => updateField('jlptLevel', (v === '' ? '' : v) as JLPTLevel | '')}
                  ariaLabelledBy="jlpt-label"
                />
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Right column. Sticks to the top of the scroll area (<main>) while
            the field column scrolls, so the preview and Save pin flush with the
            top of the form rather than drifting. */}
        <aside className="flex flex-col gap-6 lg:col-span-6 lg:sticky lg:top-12 lg:self-start">
          <PreviewBlock
            card={previewCard}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            aiError={aiError}
            sentenceCount={sentenceCount}
            sentenceIndex={clampedPreviewIdx}
            onPrevSentence={() => setPreviewSentenceIdx((i) => Math.max(0, i - 1))}
            onNextSentence={() => setPreviewSentenceIdx((i) => Math.min(sentenceCount - 1, i + 1))}
          />
          <SaveBlock
            saving={saving}
            busy={busy}
            blockers={blockers}
            attemptedSave={attemptedSave}
            saveError={saveError}
            onSave={onSave}
            onCancel={onCancel}
          />
        </aside>
      </div>
    </Frame>
  )
}

// ── Frame ─────────────────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Top-anchored (not desktopCentered): this is a long scrollable form, and
  // page-level vertical centering would fight the sticky preview column.
  return <PageFrame>{children}</PageFrame>
}

// ── Section requirement tag ────────────────────────────────────────────────
//
// Quiet header marker stating whether a section gates saving. Only Definition
// is required here (deck placement is fixed while editing); everything else is
// optional. Rendered in the section header's rightContent slot so the contract
// is scannable down the long form without competing with the field labels.

function SectionRequirement(): React.JSX.Element {
  return (
    <span className="font-mono text-xs uppercase tracking-[0.08em] text-faded-sumi">
      Required
    </span>
  )
}

// ── Collapsible optional section ────────────────────────────────────────────
//
// Wraps a SectionCard so an optional section can collapse to just its header,
// keeping the long form short. Collapsed by default. The header carries the
// persistent "Optional" classification plus a chevron toggle; when collapsed
// with content present, a `count` ("· N") or a filled dot signals that the
// section still holds data, so disclosure never hides it silently. Definition
// stays a plain (always-open) SectionCard — it gates saving.

interface CollapsibleSectionProps {
  kanji:        string
  label:        string
  description?: string
  /** Shown as "· N" after the label (use for list sections like sentences). */
  count?:       number
  /** When no count applies, a filled dot signals the section has content. */
  hasContent?:  boolean
  children:     React.ReactNode
}

function CollapsibleSection({
  kanji, label, description, count, hasContent = false, children,
}: CollapsibleSectionProps): React.JSX.Element {
  // Optional sections that already hold content open on mount while editing —
  // unlike /add/review (always collapsed) the author is here to revise what's
  // there, so surfacing populated sections saves a click per section.
  const initiallyOpen = count !== undefined ? count > 0 : hasContent
  const [open, setOpen] = useState(initiallyOpen)
  const showDot = !open && count === undefined && hasContent

  // WAI-ARIA accordion: the whole header is a button wrapped in an <h2>, so the
  // entire row toggles (a generous target) while the section title stays a real
  // heading. `omitTitle` skips SectionCard's own CardHeader so we own the
  // markup. Header typography mirrors CardHeader so these read identically to
  // the required Definition card above.
  return (
    <SectionCard kanji={kanji} label={label} omitTitle>
      <h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            'flex w-full items-start gap-3 rounded-xs text-left',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          )}
        >
          <span
            lang="ja"
            aria-hidden="true"
            className="shrink-0 translate-y-[0.05em] font-display text-xl leading-none text-inari-vermillion"
          >
            {kanji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80">
              {label}
              {count !== undefined && <span className="text-faded-sumi">· {count}</span>}
            </span>
            {description !== undefined && (
              <span className="mt-2 block max-w-measure text-sm leading-[1.55] text-faded-sumi">
                {description}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2 pt-0.5 font-mono text-xs uppercase tracking-[0.08em] text-faded-sumi">
            {showDot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-matcha-green/70" />}
            {open ? 'Less' : 'Optional'}
            <IconChevronDown
              aria-hidden="true"
              className={cn('h-3 w-3 transition-transform duration-200 ease-out', open ? 'rotate-180' : 'rotate-0')}
            />
          </span>
        </button>
      </h2>
      {open && (
        <div className="mt-3 flex flex-col gap-6 border-t border-soft-hairline pt-5">
          {children}
        </div>
      )}
    </SectionCard>
  )
}

// ── Deck picker card ──────────────────────────────────────────────────────────
//
// First SectionCard in the form stack. The card's deck is editable here: the
// content PATCH doesn't carry a deck change, so a switch is reconciled at save
// time via the move endpoint (see onSave). When the user has no other decks,
// there's nothing to switch to, so it degrades to the read-only chip it was
// before — a calm statement of where the card lives.

interface DeckPickerCardProps {
  decks:         DeckOption[]
  value:         string
  currentDeckId: string
  deckName:      string
  onChange:      (deckId: string) => void
}

function DeckPickerCard({
  decks, value, currentDeckId, deckName, onChange,
}: DeckPickerCardProps): React.JSX.Element {
  const hasAlternatives = decks.some((d) => d.id !== currentDeckId)
  const moved           = value !== currentDeckId

  // No other decks to move into → keep the original read-only presentation.
  if (!hasAlternatives) {
    return (
      <SectionCard
        kanji="組"
        label="Deck"
        description={`This card lives in ${deckName}. Create another deck to move it elsewhere.`}
      >
        <div className="pt-1">
          <span className="inline-flex items-center rounded-xs border border-soft-hairline bg-cream-inset px-2.5 py-1 text-sm text-sumi-ink">
            {deckName}
          </span>
        </div>
      </SectionCard>
    )
  }

  const options: ReadonlyArray<TomoSelectOption<string>> = decks.map((d) => ({ value: d.id, label: d.name }))

  return (
    <SectionCard
      kanji="組"
      label="Deck"
      description="The deck this card belongs to. Switch it to move the card on save."
    >
      <div className="flex flex-col gap-2 pt-1">
        <span id="deck-label" className="text-sm font-medium text-sumi-ink/85">Deck</span>
        <TomoSelect<string>
          value={value}
          options={options}
          onValueChange={onChange}
          ariaLabelledBy="deck-label"
        />
        {moved && (
          <p role="status" className="mt-1 text-sm text-faded-sumi">
            Saving moves this card to the new deck. Its review history and scheduling come with it.
          </p>
        )}
      </div>
    </SectionCard>
  )
}

// ── Preview block ─────────────────────────────────────────────────────────────

interface PreviewBlockProps {
  card:           ApiDueCard
  flipped:        boolean
  onFlip:         () => void
  aiError:        string | null
  sentenceCount:  number
  sentenceIndex:  number
  onPrevSentence: () => void
  onNextSentence: () => void
}

function PreviewBlock({
  card, flipped, onFlip, aiError,
  sentenceCount, sentenceIndex, onPrevSentence, onNextSentence,
}: PreviewBlockProps): React.JSX.Element {
  // The pager only earns its place once a card has more than one sentence;
  // with 0 or 1 there is nothing to rotate, so it stays hidden.
  const showPager = sentenceCount > 1
  const flipToggle = (
    <button
      type="button"
      onClick={onFlip}
      aria-pressed={flipped}
      aria-label={flipped ? 'Show front of card' : 'Show back of card'}
      className={cn(
        'inline-flex items-center gap-2 rounded-xs px-1.5 py-0.5',
        'text-sm',
        'text-faded-sumi hover:text-sumi-ink transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
      )}
    >
      <IconUndo aria-hidden="true" className="w-[11px] h-[11px]" />
      {flipped ? 'Show front' : 'Show back'}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionCard
        kanji="観"
        label="Preview"
        description="The card as the learner will see it in practice."
        rightContent={flipToggle}
      >
        <div
          aria-live="polite"
          aria-atomic="true"
          className="px-1 pt-3 pb-4 md:px-2 md:pt-5 md:pb-6"
        >
          {flipped
            ? <CardBack card={card} exampleSentenceIndex={sentenceIndex} />
            : <CardFront card={card} exampleSentenceIndex={sentenceIndex} />}
        </div>
      </SectionCard>

      {showPager && (
        <div className="flex items-center justify-end gap-3 px-1">
          <div className="flex items-center gap-2">
            <PagerButton
              onClick={onPrevSentence}
              disabled={sentenceIndex <= 0}
              ariaLabel="Preview previous sentence"
            >‹</PagerButton>
            <span className="text-sm text-faded-sumi tabular-nums" aria-live="polite">
              Sentence {sentenceIndex + 1} of {sentenceCount}
            </span>
            <PagerButton
              onClick={onNextSentence}
              disabled={sentenceIndex >= sentenceCount - 1}
              ariaLabel="Preview next sentence"
            >›</PagerButton>
          </div>
        </div>
      )}

      {aiError !== null && <p role="alert" className="text-sm text-error">{aiError}</p>}
    </div>
  )
}

// Square chevron control for the preview sentence pager. Disabled at the ends
// of the list; matches the quiet font-mono register of the preview chrome.
function PagerButton({
  onClick, disabled, ariaLabel, children,
}: {
  onClick:   () => void
  disabled:  boolean
  ariaLabel: string
  children:  React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-xs',
        'border border-soft-hairline font-mono text-sm leading-none',
        'transition-colors duration-150',
        disabled
          ? 'text-faded-sumi/40 cursor-not-allowed'
          : 'text-faded-sumi hover:text-sumi-ink hover:border-sumi-ink/30',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
      )}
    >
      {children}
    </button>
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
  const add    = (): void => onChange([...entries, { id: nextRowKey(), kanji: '', radical: '', meaning: '', reading: '' }])

  return (
    <div className="flex flex-col gap-4 pt-1">
      {entries.length === 0 && (
        <p className="text-sm text-faded-sumi">No kanji listed. Add one if it helps learners see the parts.</p>
      )}
      {entries.map((entry, i) => (
        <div key={entry.id} className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
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

// ── Sentence editor ───────────────────────────────────────────────────────────
//
// Single-expand accordion for the card's example sentences. Each sentence
// collapses to a one-line summary (truncated Japanese + a warning dot when it
// omits the card's word) and expands in place to the three fields. Keeps the
// section short at the 10-sentence cap. Rows are hairline-separated, not
// nested cards. No "primary" row: the review back rotates across the set, so
// order is the author's browsing order only. The per-sentence "doesn't
// include the word" note is informational, never a save gate.

interface SentenceEditorProps {
  entries:            SentenceEntry[]
  word:               string
  onChange:           (next: SentenceEntry[]) => void
  /** AI per-row regenerate; omitted when the card has no word to key off. */
  onRegenerateRow?:   (id: string) => void
  regeneratingId?:    string | null
  /** Skeleton placeholder rows for an in-flight batch generation, appended
   *  to the bottom of the list. */
  pendingCount?:      number
}

function SentenceEditor({
  entries, word, onChange, onRegenerateRow, regeneratingId = null, pendingCount = 0,
}: SentenceEditorProps): React.JSX.Element {
  // One row open at a time, tracked by id so the open row follows its sentence
  // across add/remove without index bookkeeping.
  const [editingId, setEditingId] = useState<string | null>(null)

  const update = (i: number, patch: Partial<SentenceEntry>): void =>
    onChange(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  // Removing by index is fine — the array is the source of truth. editingId
  // self-corrects: if the open row is the one removed, its id no longer matches
  // and the accordion collapses; otherwise the open row stays open.
  const remove = (i: number): void => onChange(entries.filter((_, idx) => idx !== i))
  const add = (): void => {
    const entry: SentenceEntry = { id: nextRowKey(), ja: '', en: '', furigana: '' }
    onChange([...entries, entry])
    setEditingId(entry.id)
  }

  const trimmedWord = word.trim()
  const atCap       = entries.length >= MAX_SENTENCES

  return (
    <div className="flex flex-col pt-1">
      {entries.length === 0 && (
        <p className="text-sm text-faded-sumi pb-2">
          No example sentences yet. Add one, or generate a few with AI below.
        </p>
      )}
      {entries.map((entry, i) => {
        const ja          = entry.ja.trim()
        const missingWord = ja.length > 0 && trimmedWord.length > 0 && !ja.includes(trimmedWord)
        const open        = editingId === entry.id
        const regenning   = regeneratingId === entry.id
        return (
          <div key={entry.id} className={cn(i > 0 && 'border-t border-soft-hairline')}>
            {/* Summary row: expand toggle + Remove sit as siblings (no nested
                interactive elements). */}
            <div className="flex items-center gap-2 py-2.5">
              <button
                type="button"
                onClick={() => setEditingId(open ? null : entry.id)}
                aria-expanded={open}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-xs text-left',
                  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('font-mono text-faded-sumi leading-none transition-transform duration-150', open && 'rotate-90')}
                >
                  ›
                </span>
                <span className="shrink-0 text-sm text-faded-sumi">{i + 1}</span>
                <span
                  lang="ja"
                  className={cn('min-w-0 truncate text-base', ja.length > 0 ? 'text-sumi-ink' : 'italic text-faded-sumi')}
                >
                  {ja.length > 0 ? entry.ja : 'Empty sentence'}
                </span>
                {missingWord && (
                  <span
                    aria-label={`Sentence ${i + 1} does not include the word`}
                    className="ml-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-inari-vermillion/70"
                  />
                )}
              </button>
              <QuietLink onClick={() => remove(i)} tone="sumi" size="sm" ariaLabel={`Remove sentence ${i + 1}`}>
                Remove
              </QuietLink>
            </div>

            {open && (
              <div className="flex flex-col gap-4 pb-5 pt-1">
                <Textarea
                  label="Japanese"
                  value={entry.ja}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => update(i, { ja: e.target.value })}
                  placeholder="今日は木漏れ日だから、人が少ない。"
                  script="mixed"
                  rows={2}
                  block
                />
                {missingWord && (
                  <p role="status" className="text-sm text-faded-sumi">
                    This sentence doesn’t include {trimmedWord}. That’s fine if it’s a conjugated form.
                  </p>
                )}
                <Textarea
                  label="Furigana"
                  value={entry.furigana}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => update(i, { furigana: e.target.value })}
                  placeholder="きょうはこもれびだから、ひとがすくない。"
                  script="kana"
                  rows={2}
                  block
                  hint="Optional. Falls back to the plain sentence if empty."
                />
                <Textarea
                  label="Translation"
                  value={entry.en}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => update(i, { en: e.target.value })}
                  placeholder="There are few people today because of the dappled light."
                  rows={2}
                  block
                />
                {onRegenerateRow !== undefined && (
                  <div>
                    <QuietLink
                      onClick={() => onRegenerateRow(entry.id)}
                      tone="sumi"
                      size="sm"
                      ariaLabel={`Regenerate sentence ${i + 1} with AI`}
                    >
                      {regenning ? 'Regenerating…' : 'Regenerate this sentence'}
                    </QuietLink>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {pendingCount > 0 && <SentenceSkeletons count={pendingCount} />}

      <div>
        {atCap ? (
          <p className="pt-3 text-sm text-faded-sumi">Up to {MAX_SENTENCES} sentences.</p>
        ) : (
          <div className="pt-3">
            <QuietLink onClick={add} tone="brand" size="sm" ariaLabel="Add example sentence">+ Add sentence</QuietLink>
          </div>
        )}
      </div>
    </div>
  )
}

// Skeleton placeholder rows shown while a batch of sentences generates, so the
// number of inbound sentences is visible. Opacity pulse only (no layout
// animation); the global stylesheet disables it under prefers-reduced-motion.
function SentenceSkeletons({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 border-t border-soft-hairline py-2.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faded-sumi/25" />
          <span className="h-3 w-1/2 rounded bg-cream-inset/70 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ── Save block ────────────────────────────────────────────────────────────────
//
// Inline action under the preview — no SectionCard wrapper. The preview is
// the artifact, this is the verb. A single status line above the button
// names the load-bearing blocker (or confirms readiness) so the requirement
// stays visible without competing for attention. A Cancel link sits beside
// Save so leaving without changes is one click.

interface SaveBlockProps {
  saving:        boolean
  /** Disables the button while in flight. The button stays enabled with
   *  blockers present so a click can surface them. */
  busy:          boolean
  blockers:      string[]
  /** A blocked attempt escalates the blocker line from calm guidance to error. */
  attemptedSave: boolean
  saveError:     string | null
  onSave:        () => void
  onCancel:      () => void
}

function SaveBlock({
  saving, busy, blockers, attemptedSave, saveError, onSave, onCancel,
}: SaveBlockProps): React.JSX.Element {
  const blocked = blockers.length > 0
  return (
    <div className="flex flex-col gap-3 px-1">
      {blocked ? (
        <p
          role={attemptedSave ? 'alert' : 'status'}
          className={cn('text-sm', attemptedSave ? 'text-error' : 'text-faded-sumi')}
        >
          {blockers[0]}
        </p>
      ) : (
        <p className="text-sm text-faded-sumi">Ready to save your changes.</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onSave}
          disabled={busy}
          loading={saving}
          className="w-full sm:flex-1"
        >
          Save changes
        </Button>
        <Button
          type="button"
          variant="editorial"
          size="lg"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
      </div>
      <SaveShortcutHint />
      {saveError !== null && (
        <p className="text-sm text-error" role="alert">{saveError}</p>
      )}
    </div>
  )
}

// Quiet keyboard-shortcut hint under the Save button, so the existing
// Cmd/Ctrl+Enter path is discoverable instead of hidden. Resolved after mount:
// shown only on keyboard-capable (fine-pointer) devices, so touch users aren't
// told to press a key they don't have. Starting hidden also keeps SSR
// hydration deterministic (server and first client render both emit nothing).
function SaveShortcutHint(): React.JSX.Element | null {
  const [hint, setHint] = useState<{ show: boolean; isMac: boolean }>({ show: false, isMac: false })
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
    setHint({ show: finePointer, isMac })
  }, [])
  if (!hint.show) return null
  return (
    <p className="text-xs text-faded-sumi">
      Press{' '}
      <kbd className="rounded-xs border border-soft-hairline px-1 py-0.5 font-mono text-sm text-sumi-ink/70">
        {hint.isMac ? '⌘' : 'Ctrl'}
      </kbd>
      {' '}
      <kbd className="rounded-xs border border-soft-hairline px-1 py-0.5 font-mono text-sm text-sumi-ink/70">
        Enter
      </kbd>
      {' '}to save.
    </p>
  )
}

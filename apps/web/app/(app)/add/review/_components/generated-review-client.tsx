'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { IconUndo, IconChevronDown, IconEdit } from '@/components/icons/chrome-marks'

import {
  partOfSpeechEnum,
  pitchPatternEnum,
  type ApiDueCard,
  type JLPTLevel,
} from '@fsrs-japanese/shared-types'

import { useAddReviewDevState } from '@/dev/panels/add-review'

import { Button }       from '@/components/ui/Button'
import { Input }        from '@/components/ui/Input'
import { PageFrame }    from '@/app/(app)/_components/page-frame'
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar'
import { Logo }         from '@/components/ui/Logo'
import { PageHeader }   from '@/components/ui/PageHeader'
import { QuietLink }    from '@/components/ui/QuietLink'
import { SectionCard }  from '@/components/ui/SectionCard'
import { Textarea }     from '@/components/ui/Textarea'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'
import { PageLoader }   from '@/components/ui/TomoLoader'
import { CardBack }     from '@/components/review/session/CardBack'
import { CardFront }    from '@/components/review/session/CardFront'
import { useDecks }     from '@/lib/api/decks'
import {
  generateCardPreviewAction,
  generateSentencesByWordAction,
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

// One authored example sentence. Mirrors `ExampleSentenceSchema`
// (packages/shared-types). A card holds an ordered list; the review back
// shows one per review (rotated stable-randomly), so list order is the
// author's browsing order, not a display priority.
interface SentenceEntry { ja: string; en: string; furigana: string }

// Cap on authored example sentences. Keeps the editor bounded and storage
// sane; the rotation cycles through whatever is present.
const MAX_SENTENCES = 10

// How many sentences one "Generate examples" click fetches (clamped to the
// remaining headroom under MAX_SENTENCES).
const SENTENCE_BATCH = 3

interface CardFields {
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

function makeEmptyFields(): CardFields {
  return {
    word: '', reading: '', meaning: '', partOfSpeech: '',
    nuance: '', mnemonic: '',
    pitchAccent: '', pitchPosition: '',
    frequencyRank: '', jlptLevel: '',
    sentences: [],
    kanjiBreakdown: [],
    picture: null,
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

// Shared by the synthetic preview card and the save/update payloads — keeps
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
  if (fields.kanjiBreakdown.length > 0)   fieldsData.kanjiBreakdown = fields.kanjiBreakdown.filter((k) => k.kanji.trim().length > 0)
  const freq = Number(fields.frequencyRank);   if (Number.isFinite(freq) && freq > 0) fieldsData.frequencyRank = freq
  const pos  = Number(fields.pitchPosition);   if (Number.isFinite(pos))              fieldsData.pitchPosition  = pos

  return fieldsData
}

function buildPreviewCard(fields: CardFields): ApiDueCard {
  // The `ApiDueCard.fieldsData` type is the tight `FieldsData` union; the
  // unknown-cast is safe because this synthetic preview card is
  // layoutType='vocabulary' and `buildFieldsData` always populates
  // word/reading/meaning — the runtime shape matches the VocabularyFieldsData
  // arm of the union.
  return {
    id:         'preview-card',
    deckId:     'preview-deck',
    jlptLevel:  fields.jlptLevel === '' ? null : fields.jlptLevel,
    state:      0,
    due:        new Date().toISOString(),
    layoutType: 'vocabulary',
    fieldsData: buildFieldsData(fields) as unknown as ApiDueCard['fieldsData'],
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GeneratedReviewClient(): React.JSX.Element {
  useAddReviewDevState()
  const router         = useRouter()
  const [, startNav]   = useTransition()
  const draft          = useCaptureDraftStore((s) => s.draft)
  const captureActions = useCaptureDraftActions()

  const noDraft = draft.word.trim().length === 0
  // Tracked via a ref so the redirect effect doesn't have to depend on the
  // `saved` state (declared further down) and re-run when it changes. Once
  // we've saved, the draft is intentionally empty (captureActions.reset()
  // at save time) — the redirect would bounce the user off the success
  // screen they just earned, so it must not fire post-save.
  const hasSavedRef = useRef<boolean>(false)
  useEffect(() => {
    if (!noDraft) return
    if (hasSavedRef.current) return
    router.replace('/add')
  }, [noDraft, router])

  // ── Live state ────────────────────────────────────────────────────────
  const [fields,  setFields]  = useState<CardFields>(() => ({
    ...makeEmptyFields(),
    word:      draft.word,
    reading:   draft.reading,
    meaning:   draft.meaning,
    mnemonic:  draft.mnemonic,
    sentences: draft.sentence.trim().length > 0
      ? [{ ja: draft.sentence, en: '', furigana: '' }]
      : [],
    picture:   draft.imageDataUrl,
  }))
  const [deckId,  setDeckId]  = useState<string | null>(draft.deckId)
  const [flipped, setFlipped] = useState<boolean>(false)
  // Which example sentence the preview pins (the review back rotates; the
  // author pages through them here). Clamped against the live count at render.
  const [previewSentenceIdx, setPreviewSentenceIdx] = useState<number>(0)

  const isAiPath = draft.mode === 'generate'
  const needsSeed = isAiPath && draft.reading === ''
  const [generating,    setGenerating]    = useState<boolean>(needsSeed)
  const [aiError,       setAiError]       = useState<string | null>(null)
  // Batch sentence generation: `pendingCount` drives the skeleton placeholder
  // rows so the author sees how many sentences are inbound.
  const [generatingBatch, setGeneratingBatch] = useState<boolean>(false)
  const [pendingCount,    setPendingCount]    = useState<number>(0)
  // Index of the single row being regenerated in place (null = none).
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)
  const [regenMnemonic,   setRegenMnemonic]   = useState<boolean>(false)

  // The save flow as one discriminated union: impossible combinations (saving
  // *and* saved, or error *and* saving) are unrepresentable, and each terminal
  // state carries exactly the data it needs.
  type SaveState =
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'error';  message: string }
    | { status: 'saved';  count: number; deckName: string }
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  // Flips true the first time the user attempts a save while a blocker is
  // still unmet. Until then, unmet requirements read as calm guidance
  // (faded-sumi); after a blocked attempt they escalate to error tone. Reset
  // on the next field/deck edit so the form returns to calm once the user
  // re-engages — the same "status reflects current truth" pattern used below.
  const [attemptedSave, setAttemptedSave] = useState<boolean>(false)

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
  // StrictMode (dev) and any future remount run this effect more than once.
  // The cancelled flag below guards the async setState, but not the call
  // itself — so without a persistent guard the billable generateCardPreviewAction
  // fires twice on first mount. A ref survives the remount, pinning the request
  // to exactly one dispatch.
  const seedFiredRef = useRef(false)
  useEffect(() => {
    if (!generating || seedFiredRef.current) return
    seedFiredRef.current = true
    let cancelled = false
    void generateCardPreviewAction(draft.word.trim())
      .then((data) => {
        if (cancelled) return
        // Seed every generated sentence (capped) only when the author hasn't
        // already typed their own; never clobber an in-progress edit.
        const generated = (data.exampleSentences ?? [])
          .slice(0, MAX_SENTENCES)
          .map((s) => ({ ja: s.ja, en: s.en, furigana: s.furigana }))
        setFields((prev) => ({
          ...prev,
          reading:      data.reading,
          meaning:      data.meaning,
          partOfSpeech: data.partOfSpeech ?? prev.partOfSpeech,
          mnemonic:     data.mnemonic    ?? prev.mnemonic,
          pitchAccent:  data.pitchAccent ?? prev.pitchAccent,
          sentences:    prev.sentences.length > 0 ? prev.sentences : generated,
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

  // Preview pager: indexes the same non-empty sentences `buildFieldsData`
  // emits, so the pinned index lines up with the preview card's array.
  const sentenceCount = useMemo(
    () => fields.sentences.filter((s) => s.ja.trim().length > 0).length,
    [fields.sentences],
  )
  const clampedPreviewIdx = sentenceCount > 0 ? Math.min(previewSentenceIdx, sentenceCount - 1) : 0

  // Hard save gates only: a definition and a deck. The "sentence doesn't
  // include the word" check moved to a per-sentence inline warning (see
  // SentenceEditor) — with conjugation and multiple sentences a hard block
  // would be hostile, so it informs rather than prevents.
  const blockers = useMemo<string[]>(() => {
    const list: string[] = []
    if (fields.meaning.trim().length === 0) list.push('Add a definition to save.')
    if (deckId === null)                    list.push('Pick a deck to save into.')
    return list
  }, [fields.meaning, deckId])

  // The Save button stays clickable whenever the form isn't mid-flight, even
  // with blockers present: a disabled button can't explain itself, so a
  // blocked click is what surfaces the (now escalated) requirement copy.
  const busy = generating || save.status === 'saving'

  const updateField = useCallback(
    <K extends keyof CardFields>(key: K, value: CardFields[K]): void => {
      setFields((prev) => ({ ...prev, [key]: value }))
      // Re-engaging clears a prior blocked-save escalation, so unmet
      // requirements fall back to calm guidance rather than staying red.
      setAttemptedSave((prev) => (prev ? false : prev))
    }, [])

  const onDeckChange = useCallback((next: string): void => {
    setDeckId(next)
    setAttemptedSave((prev) => (prev ? false : prev))
  }, [])

  // ── Regenerate ────────────────────────────────────────────────────────
  //
  // All regeneration runs pre-save: no card exists yet, so the dedicated
  // cardId endpoints can't help (they look the card up server-side to extract
  // `word`). Sentences route through `generateSentencesByWordAction`; the
  // mnemonic re-runs the full preview generator and slices the field. Once the
  // card is saved the form is replaced by the success screen, so there is no
  // post-save regeneration path to feed.

  // Snapshot of the current non-empty Japanese lines. Sent as `avoid` so the
  // server prompts for fresh, distinct sentences (and caches per-context), and
  // reused to dedupe what comes back.
  const existingJa = useCallback(
    (): string[] => fields.sentences.map((s) => s.ja.trim()).filter((s) => s.length > 0),
    [fields.sentences],
  )

  // Generate a batch in one call and append the new, deduped sentences (up to
  // the cap), routed by `word`.
  const onGenerateExamples = useCallback((): void => {
    if (generatingBatch || generating) return
    const word = fields.word.trim()
    if (word.length === 0) return
    const remaining = MAX_SENTENCES - fields.sentences.length
    if (remaining <= 0) return

    const want   = Math.min(SENTENCE_BATCH, remaining)
    const avoid  = existingJa()
    setGeneratingBatch(true); setPendingCount(want); setAiError(null)

    void generateSentencesByWordAction(word, want, avoid)
      .then((data) => {
        const seen  = new Set(avoid)
        const fresh: SentenceEntry[] = []
        for (const s of data.sentences) {
          const ja = s.ja.trim()
          if (ja.length === 0 || seen.has(ja)) continue
          seen.add(ja)
          fresh.push({ ja: s.ja, en: s.en, furigana: s.furigana })
        }
        if (fresh.length > 0) {
          setFields((prev) => ({
            ...prev,
            sentences: [...prev.sentences, ...fresh].slice(0, MAX_SENTENCES),
          }))
        }
      })
      .catch((err: unknown) => setAiError(err instanceof Error ? err.message : 'Generation failed.'))
      .finally(() => { setGeneratingBatch(false); setPendingCount(0) })
  }, [generatingBatch, generating, fields.word, fields.sentences, existingJa])

  // Replace a single sentence in place with a fresh AI generation, telling the
  // model to avoid every current sentence so it doesn't echo what's there.
  const onRegenerateRow = useCallback((index: number): void => {
    if (regeneratingIdx !== null || generating) return
    const word = fields.word.trim()
    if (word.length === 0) return

    const avoid = existingJa()
    setRegeneratingIdx(index); setAiError(null)

    void generateSentencesByWordAction(word, 1, avoid)
      .then((data) => {
        const first = data.sentences[0]
        if (first !== undefined) {
          setFields((prev) => ({
            ...prev,
            sentences: prev.sentences.map((s, i) =>
              i === index ? { ja: first.ja, en: first.en, furigana: first.furigana } : s),
          }))
        }
      })
      .catch((err: unknown) => setAiError(err instanceof Error ? err.message : 'Regeneration failed.'))
      .finally(() => setRegeneratingIdx(null))
  }, [regeneratingIdx, generating, fields.word, existingJa])

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
  //
  // A blocked attempt (missing definition or deck) flips `attemptedSave` so the
  // requirement copy escalates from calm guidance to error tone, then bails. A
  // clean attempt POSTs via saveCardAction and shows the success screen.
  const onSave = useCallback(async (): Promise<void> => {
    if (save.status === 'saving' || generating) return
    if (blockers.length > 0) { setAttemptedSave(true); return }
    if (deckId === null) return
    setSave({ status: 'saving' })
    try {
      await saveCardAction(deckId, {
        mode: 'manual',
        fieldsData: buildFieldsData(fields),
        layoutType: 'vocabulary',
        ...(fields.jlptLevel !== '' ? { jlptLevel: fields.jlptLevel } : {}),
      })
      // Flip *before* resetting the draft so the noDraft → redirect effect
      // sees `hasSavedRef.current === true` on the very next render (refs are
      // synchronous; state is not).
      hasSavedRef.current = true
      captureActions.reset()
      setSave({ status: 'saved', count: 1, deckName: deckName ?? 'your deck' })
    } catch (err: unknown) {
      // 'saved' and 'error' are both terminal (not 'saving'), so no finally
      // is needed to clear an in-flight flag — the union does that by shape.
      setSave({ status: 'error', message: err instanceof Error ? err.message : 'Could not save the card.' })
    }
  }, [save.status, generating, blockers, deckId, fields, deckName, captureActions])

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

  // ── Renders ───────────────────────────────────────────────────────────
  // Only short-circuit on noDraft *before* a save has happened. After save,
  // captureActions.reset() empties the draft intentionally — letting the
  // loading stub steal the render would hide the SuccessBlock entirely.
  if (noDraft && save.status !== 'saved') {
    return (
      <PageLoader
        stageLabels={[
          'Reading the word…',
          'Drafting reading and meaning…',
          'Writing an example sentence…',
          'Polishing the mnemonic…',
        ]}
      />
    )
  }

  // While the AI is generating the card preview (the user has a word but
  // not yet a populated draft), hold the form behind the page loader with
  // rotating stage labels so the 2–10s wait reads as deliberate work.
  if (generating) {
    return (
      <PageLoader
        stageLabels={[
          'Reading the word…',
          'Drafting reading and meaning…',
          'Writing an example sentence…',
          'Polishing the mnemonic…',
        ]}
      />
    )
  }

  // SuccessBlock is the terminal celebratory state once a card is saved.
  if (save.status === 'saved') {
    return (
      // Short closure screen: vertically centered (desktopCentered) rather
      // than top-anchored like the long form.
      <PageFrame desktopCentered>
        <SuccessBlock
          count={save.count}
          deckName={save.deckName}
          onAddAnother={() => startNav(() => router.push('/add'))}
          onReturnToToday={() => startNav(() => router.push('/today'))}
        />
      </PageFrame>
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

  return (
    <Frame>
      <PageHeader kanji={header.kanji} label={header.label} title={header.title} subtitle={header.subtitle} />

      {/* Two-column desktop (6/6): field SectionCards left, preview + Save right.
          items-start at every breakpoint: below lg this is a single-column grid
          whose default align-items:stretch would stretch the left-column track
          to the grid's (definite, flex-1-derived) height. The left column is a
          flex-col of h-full SectionCards, so that stretch splits into equal-height
          slabs and SectionCard's overflow-hidden clips the taller sections. Pin
          items to start so each card keeps its content height.
          grid-cols-1 (minmax(0,1fr)) at the base breakpoint is load-bearing too:
          without it, below lg the grid has no column template and falls back to
          an implicit auto track that grows to its content's min-content width. A
          textarea's intrinsic min-content (its default cols) then drags the
          column past the viewport when the Example sentences editor expands. The
          explicit 1fr track refuses to grow past the container. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-10">
        {/* Left: field SectionCards. lg:order-first reasserts source order on
            desktop; on mobile the aside below claims order-first so the card the
            user is confirming leads the page instead of trailing six form
            sections. */}
        <div className="lg:order-first lg:col-span-6 flex flex-col gap-6 lg:gap-7">
          <DeckCard
            options={deckOptions}
            value={deckId}
            onChange={onDeckChange}
            loading={decksQuery.isLoading}
            deckName={deckName}
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
                regeneratingIndex={regeneratingIdx}
                pendingCount={pendingCount}
                {...(isAiPath ? { onRegenerateRow } : {})}
              />
              {isAiPath && fields.sentences.length < MAX_SENTENCES && (
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
              {isAiPath && (
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

        {/* Right column. On mobile this leads the page (order-first) so the
            card being confirmed is the first thing seen; the form sections and a
            sticky bottom Save bar follow. At lg it reverts to the right rail and
            sticks to the top of the scroll area (<main>) while the field column
            scrolls:
              - top-12 (3rem) matches PageFrame's lg top padding, so the pinned
                preview lines up with where the field column begins.
              - self-start keeps the aside content-height so the sticky offset
                applies inside the taller field-column grid row.
            No max-height / internal scroll: the aside is its natural height so
            it never shows its own scrollbar over the preview. */}
        <aside className="order-first lg:order-none flex flex-col gap-6 lg:col-span-6 lg:sticky lg:top-12 lg:self-start">
          <PreviewBlock
            card={previewCard}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            loading={generating}
            aiError={aiError}
            sentenceCount={sentenceCount}
            sentenceIndex={clampedPreviewIdx}
            onPrevSentence={() => setPreviewSentenceIdx((i) => Math.max(0, i - 1))}
            onNextSentence={() => setPreviewSentenceIdx((i) => Math.min(sentenceCount - 1, i + 1))}
          />
          {/* Desktop Save lives under the sticky preview. On mobile it's hidden
              here and re-homed to the bottom sticky bar so it stays in reach
              without scrolling the full form. */}
          <div className="hidden lg:block">
            <SaveBlock
              saving={save.status === 'saving'}
              busy={busy}
              blockers={blockers}
              attemptedSave={attemptedSave}
              saveError={save.status === 'error' ? save.message : null}
              onSave={onSave}
            />
          </div>
        </aside>
      </div>

      {/* Mobile-only: the primary action pinned to the bottom of the viewport,
          so Save is always one tap away regardless of scroll position. Hidden
          at lg, where the Save block rides the sticky preview column instead. */}
      <MobileStickyActionBar ariaLabel="Save card">
        <SaveBlock
          saving={save.status === 'saving'}
          busy={busy}
          blockers={blockers}
          attemptedSave={attemptedSave}
          saveError={save.status === 'error' ? save.message : null}
          onSave={onSave}
        />
      </MobileStickyActionBar>
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
// Quiet header marker stating whether a section gates saving. Only Deck and
// Definition are required; everything else is optional. Rendered in the
// section header's rightContent slot so the contract is scannable down the
// long form without competing with the field labels.

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
// section still holds data, so disclosure never hides it silently. Deck and
// Definition stay plain (always-open) SectionCards — they gate saving.

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
  const [open, setOpen] = useState(false)
  const showDot = !open && count === undefined && hasContent

  // WAI-ARIA accordion: the whole header is a button wrapped in an <h2>, so the
  // entire row toggles (a generous target) while the section title stays a real
  // heading. `omitTitle` skips SectionCard's own CardHeader so we own the
  // markup — which also means the rule and spacing are conditional in JSX (no
  // arbitrary-variant `!important` hacks needed). Header typography mirrors
  // CardHeader so these read identically to the required Deck / Definition
  // cards above.
  return (
    <SectionCard kanji={kanji} label={label} omitTitle>
      <h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            'flex w-full items-start gap-3 rounded-[2px] text-left',
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

// ── Deck card ─────────────────────────────────────────────────────────────────
//
// First SectionCard in the form stack. Treats deck assignment as a structural
// decision in the same register as Definition / Pronunciation / Teaching
// notes, with a single inline "Required" line under the select when empty so
// the requirement is locatable without doubling the Save-block blocker copy.

interface DeckCardProps {
  options:  ReadonlyArray<TomoSelectOption<string>>
  value:    string | null
  onChange: (next: string) => void
  loading:  boolean
  deckName: string | null
}

// The requirement is carried by the header "Required" tag (at the field) and
// the SaveBlock blocker line (at the action) — the same two-signal pattern the
// Definition card uses. The card's own description handles locality, so no
// inline error line is needed here.
function DeckCard({ options, value, onChange, loading, deckName }: DeckCardProps): React.JSX.Element {
  const empty = value === null
  return (
    <SectionCard
      kanji="組"
      label="Deck"
      rightContent={<SectionRequirement />}
      description={
        empty
          ? 'Pick where this card will live.'
          : `This card will be saved to ${deckName ?? 'your selected deck'}.`
      }
    >
      <div className="pt-1">
        <div className="w-full sm:max-w-[440px]">
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
    </SectionCard>
  )
}

// ── Preview block ─────────────────────────────────────────────────────────────

interface PreviewBlockProps {
  card:           ApiDueCard
  flipped:        boolean
  onFlip:         () => void
  loading:        boolean
  aiError:        string | null
  sentenceCount:  number
  sentenceIndex:  number
  onPrevSentence: () => void
  onNextSentence: () => void
}

function PreviewBlock({
  card, flipped, onFlip, loading, aiError,
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
        // Roomier vertical hit area on touch; collapses to the quiet inline
        // size on fine-pointer (sm+) so the desktop chrome stays understated.
        'inline-flex items-center gap-2 rounded-[2px] px-2 py-2 sm:px-1.5 sm:py-0.5',
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
          className={cn(
            'px-1 pt-3 pb-4 md:px-2 md:pt-5 md:pb-6 transition-opacity duration-200 ease-out',
            loading && 'opacity-70',
          )}
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

      {loading && (
        <p role="status" className="text-sm text-faded-sumi">
          Preparing card…
        </p>
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
        // Touch-first sizing: ~40px hit area on phones, tightened to the quiet
        // 28px chrome size once a fine pointer is the likely input (sm+).
        'inline-flex h-10 w-10 sm:h-7 sm:w-7 items-center justify-center rounded-[2px]',
        'border border-soft-hairline font-mono text-base sm:text-sm leading-none',
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
  /** AI per-row regenerate; omitted on the manual path. */
  onRegenerateRow?:   (i: number) => void
  regeneratingIndex?: number | null
  /** Skeleton placeholder rows for an in-flight batch generation, appended
   *  to the bottom of the list. */
  pendingCount?:      number
}

function SentenceEditor({
  entries, word, onChange, onRegenerateRow, regeneratingIndex = null, pendingCount = 0,
}: SentenceEditorProps): React.JSX.Element {
  // One row open at a time. Manual adds open immediately (you need to type);
  // AI-appended rows stay collapsed because they already carry content.
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const update = (i: number, patch: Partial<SentenceEntry>): void =>
    onChange(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  const remove = (i: number): void => {
    onChange(entries.filter((_, idx) => idx !== i))
    // Keep the open row pointing at the same sentence after the splice.
    setEditingIndex((cur) =>
      cur === null ? null : cur === i ? null : cur > i ? cur - 1 : cur)
  }
  const add = (): void => {
    onChange([...entries, { ja: '', en: '', furigana: '' }])
    setEditingIndex(entries.length)  // index of the row just appended
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
        const open        = editingIndex === i
        const regenning   = regeneratingIndex === i
        return (
          <div key={i} className={cn(i > 0 && 'border-t border-soft-hairline')}>
            {/* Summary row: expand toggle + Remove sit as siblings (no nested
                interactive elements). */}
            <div className="flex items-center gap-2 py-2.5">
              <button
                type="button"
                onClick={() => setEditingIndex(open ? null : i)}
                aria-expanded={open}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-[2px] text-left',
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
                      onClick={() => onRegenerateRow(i)}
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
// stays visible without competing for attention.

interface SaveBlockProps {
  saving:        boolean
  /** Disables the button while in flight (generating or saving). The button
   *  stays enabled with blockers present so a click can surface them. */
  busy:          boolean
  blockers:      string[]
  /** A blocked attempt escalates the blocker line from calm guidance to error. */
  attemptedSave: boolean
  saveError:     string | null
  onSave:        () => void
}

function SaveBlock({
  saving, busy, blockers, attemptedSave, saveError, onSave,
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
        <p className="text-sm text-faded-sumi">Ready to save.</p>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onSave}
        disabled={busy}
        loading={saving}
        className="w-full"
      >
        Save card
      </Button>
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
      <kbd className="rounded-[2px] border border-soft-hairline px-1 py-0.5 font-mono text-sm text-sumi-ink/70">
        {hint.isMac ? '⌘' : 'Ctrl'}
      </kbd>
      {' '}
      <kbd className="rounded-[2px] border border-soft-hairline px-1 py-0.5 font-mono text-sm text-sumi-ink/70">
        Enter
      </kbd>
      {' '}to save.
    </p>
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
          <h1 className="font-display text-display leading-[1.05] text-sumi-ink">
            Saved {count} {cardsWord} to {deckName}.
          </h1>
          <p className="mt-3 max-w-measure text-base text-faded-sumi leading-relaxed">
            Keep adding, or return to Today.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" onClick={onAddAnother} autoFocus>
              Add another
            </Button>
            <Button variant="editorial" size="lg" onClick={onReturnToToday}>
              Return to Today
            </Button>
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center justify-center lg:order-last lg:pl-4">
          <Logo size={96} showWordmark={false} priority />
        </div>
      </div>
    </SectionCard>
  )
}

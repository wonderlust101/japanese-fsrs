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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconUndo } from '@/components/icons/chrome-marks'

import {
  getWordFields,
  getVocabularyFields,
  type ApiDueCard,
  type JLPTLevel,
} from '@fsrs-japanese/shared-types'

import { Button }       from '@/components/ui/Button'
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
  generateMnemonicAction,
  getCardByIdAction,
  moveCardAction,
  saveCardAction,
  updateCardAction,
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

// Shared by the synthetic preview card and the save/update payloads — keeps
// "what we send to the backend" and "what the preview renders" in lockstep.
function buildFieldsData(fields: CardFields): Record<string, unknown> {
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
    word:       draft.word,
    reading:    draft.reading,
    meaning:    draft.meaning,
    mnemonic:   draft.mnemonic,
    sentenceJa: draft.sentence,
    picture:    draft.imageDataUrl,
  }))
  const [deckId,  setDeckId]  = useState<string | null>(draft.deckId)
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
  // Captured from the save response so subsequent regenerations can call
  // the cheap, dedicated `/api/v1/ai/generate-sentences` and
  // `/generate-mnemonic` endpoints instead of re-running the full
  // generate-card flow. Stays null pre-save (the dedicated endpoints
  // require a saved cardId to look up `word` server-side).
  const [savedCardId,  setSavedCardId]  = useState<string | null>(null)
  // Captured at save time so PATCH can satisfy If-Match. Refreshed from
  // every successful PATCH / move response so successive tweaks don't
  // need a refetch.
  const [savedVersion, setSavedVersion] = useState<number | null>(null)
  // Tracks where the saved card currently lives so we can detect that
  // the user picked a different deck during a tweak and route the change
  // through `moveCardAction` before the content PATCH.
  const [savedDeckId,  setSavedDeckId]  = useState<string | null>(null)

  // Post-save iteration UI: 'creating' is the original flow up to and
  // including the SuccessBlock terminal state; 'editing-saved' renders
  // the form again pre-filled with the just-saved values so the user
  // can tweak and PATCH back. The transition is triggered from the
  // SuccessBlock's third action ("Tweak this card").
  const [mode, setMode] = useState<'creating' | 'editing-saved'>('creating')
  // Inline feedback under the primary action in editing-saved mode:
  // 'updated' after a successful PATCH (cleared on next field edit),
  // 'conflict' after a 412 reseed (cleared on next field edit).
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updated' | 'conflict'>('idle')

  // Focusable landmark for the route-like mode change.
  const headerRef = useRef<HTMLDivElement | null>(null)

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

  const blockers = useMemo<string[]>(() => {
    const list: string[] = []
    if (fields.meaning.trim().length === 0) list.push('Add a definition to save.')
    if (deckId === null)                    list.push('Pick a deck to save into.')
    const sentence = fields.sentenceJa.trim()
    const word     = fields.word.trim()
    if (sentence.length > 0 && word.length > 0 && !sentence.includes(word)) {
      list.push('Your sentence doesn’t include the word — fix the sentence or word to save.')
    }
    return list
  }, [fields.meaning, fields.sentenceJa, fields.word, deckId])

  const canSave = !generating && !saving && blockers.length === 0

  const updateField = useCallback(
    <K extends keyof CardFields>(key: K, value: CardFields[K]): void => {
      setFields((prev) => ({ ...prev, [key]: value }))
      // Status reflects the current truth, not a timed celebration —
      // clearing on the next edit matches the existing "Ready to save."
      // ↔ blocker pattern in this form.
      setUpdateStatus((prev) => (prev === 'idle' ? prev : 'idle'))
    }, [])

  // ── Regenerate ────────────────────────────────────────────────────────
  //
  // Two paths, picked by whether the card has been saved yet:
  //
  //   - **Pre-save** (savedCardId === null): the dedicated endpoints
  //     can't help — they look up the card server-side to extract `word`,
  //     and the card doesn't exist yet. We fall back to
  //     `generateCardPreviewAction` and slice the field we want.
  //   - **Post-save** (savedCardId !== null): the cheap, dedicated
  //     endpoints (`/ai/generate-sentences`, `/ai/generate-mnemonic`)
  //     return just the field we need without re-generating the rest of
  //     the card. ~80% cheaper at the OpenAI layer.
  //
  // Note: the post-save branch is wired but not yet reachable from this
  // component — the SuccessBlock terminal state currently replaces the
  // form on save. A future post-save iteration UI (read-only seed + a
  // "tweak more" affordance that PATCHes back) will activate it.

  const onRegenSentence = useCallback((): void => {
    if (regenSentence || generating) return
    setRegenSentence(true); setAiError(null)

    const work = savedCardId !== null
      ? generateSentencesAction(savedCardId, 1).then((data) => {
          const first = data.sentences[0]
          if (first !== undefined) {
            setFields((prev) => ({ ...prev, sentenceJa: first.ja, sentenceEn: first.en, sentenceFuri: first.furigana }))
          }
        })
      : generateCardPreviewAction(fields.word.trim()).then((data) => {
          const first = data.exampleSentences?.[0]
          if (first !== undefined) {
            setFields((prev) => ({ ...prev, sentenceJa: first.ja, sentenceEn: first.en, sentenceFuri: first.furigana }))
          }
        })

    void work
      .catch((err: unknown) => setAiError(err instanceof Error ? err.message : 'Regeneration failed.'))
      .finally(() => setRegenSentence(false))
  }, [fields.word, regenSentence, generating, savedCardId])

  const onRegenMnemonic = useCallback((): void => {
    if (regenMnemonic || generating) return
    setRegenMnemonic(true); setAiError(null)

    const work = savedCardId !== null
      ? generateMnemonicAction(savedCardId).then((data) => {
          if (data.mnemonic.length > 0) {
            setFields((prev) => ({ ...prev, mnemonic: data.mnemonic }))
          }
        })
      : generateCardPreviewAction(fields.word.trim()).then((data) => {
          if (data.mnemonic !== undefined && data.mnemonic.length > 0) {
            setFields((prev) => ({ ...prev, mnemonic: data.mnemonic ?? prev.mnemonic }))
          }
        })

    void work
      .catch((err: unknown) => setAiError(err instanceof Error ? err.message : 'Regeneration failed.'))
      .finally(() => setRegenMnemonic(false))
  }, [fields.word, regenMnemonic, generating, savedCardId])

  // ── Refetch helper (412 conflict path) ────────────────────────────────
  //
  // Reseeds form state from the server's current version of the card. Used
  // by the 412 conflict path: the user's pending edits are discarded in
  // favour of whatever's now persisted, so they can re-apply changes on
  // top of fresh truth. Only the fields this form exposes are reseeded;
  // FSRS state on the server is untouched by this flow.
  const reseedFromServer = useCallback(async (cardId: string): Promise<void> => {
    const fresh = await getCardByIdAction(cardId)
    if (fresh === null) return
    // Typed access via shared-types helpers: WordFieldsSchema covers the
    // vocabulary/grammar base (word, reading, meaning, partOfSpeech, mnemonic,
    // frequencyRank, nuance, pitchPosition, expressionAudio, picture);
    // VocabularyFieldsDataSchema adds the vocabulary-only fields the form
    // exposes (exampleSentences, kanjiBreakdown, pitchAccent, collocations,
    // homophones). Sentence-layout cards yield null from both helpers; the
    // form has no shape for them, so the path collapses to empty defaults.
    const wf    = getWordFields(fresh)
    const vocab = getVocabularyFields(fresh)
    const first = vocab?.exampleSentences?.[0]
    const kanji = vocab?.kanjiBreakdown    ?? []
    const cols  = vocab?.collocations      ?? []
    const homo  = vocab?.homophones        ?? []
    setFields({
      word:            wf?.word                ?? '',
      reading:         wf?.reading             ?? '',
      meaning:         wf?.meaning             ?? '',
      partOfSpeech:    wf?.partOfSpeech        ?? '',
      nuance:          wf?.nuance              ?? '',
      mnemonic:        wf?.mnemonic            ?? '',
      pitchAccent:     vocab?.pitchAccent      ?? '',
      pitchPosition:   typeof wf?.pitchPosition === 'number' ? String(wf.pitchPosition) : '',
      expressionAudio: wf?.expressionAudio     ?? '',
      frequencyRank:   typeof wf?.frequencyRank === 'number' ? String(wf.frequencyRank)  : '',
      jlptLevel:       fresh.jlptLevel         ?? '',
      sentenceJa:      first?.ja               ?? '',
      sentenceEn:      first?.en               ?? '',
      sentenceFuri:    first?.furigana         ?? '',
      sentenceAudio:   first?.sentenceAudio    ?? '',
      kanjiBreakdown:  kanji.map((k) => ({ kanji: k.kanji, meaning: k.meaning, reading: k.reading })),
      collocations:    cols.join('\n'),
      homophones:      homo.join('\n'),
      tags:            (fresh.tags ?? []).join('\n'),
      picture:         wf?.picture             ?? null,
    })
    setDeckId(fresh.deckId)
    setSavedDeckId(fresh.deckId)
    setSavedVersion(fresh.version)
  }, [])

  // ── Save / Update ─────────────────────────────────────────────────────
  //
  // Two paths picked by `mode`:
  //   - 'creating'       → POST via saveCardAction, capture id + version + deckId
  //                        for any subsequent tweak loop, then show SuccessBlock.
  //   - 'editing-saved'  → if the deck selector moved, run moveCardAction first
  //                        (the PATCH schema is strict and doesn't accept
  //                        deckId), then PATCH content via updateCardAction.
  //                        Result is a discriminated `UpdateCardResult` so the
  //                        412 If-Match conflict surfaces as `{ ok: false,
  //                        conflict: true }` rather than a thrown error (which
  //                        would lose its class identity across the Server
  //                        Action boundary).
  const onSave = useCallback(async (): Promise<void> => {
    if (!canSave || deckId === null) return
    setSaving(true); setSaveError(null)

    if (mode === 'creating') {
      try {
        const tagList = parseList(fields.tags)
        const created = await saveCardAction(deckId, {
          mode: 'manual',
          fieldsData: buildFieldsData(fields),
          layoutType: 'vocabulary',
          ...(tagList.length > 0 ? { tags: tagList } : {}),
          ...(fields.jlptLevel !== '' ? { jlptLevel: fields.jlptLevel } : {}),
        })
        setSavedCardId(created.id)
        setSavedVersion(created.version)
        setSavedDeckId(created.deckId)
        setSaved({ count: 1, deckName: deckName ?? 'your deck' })
        // Flip *before* resetting the draft so the noDraft → redirect
        // effect sees `hasSavedRef.current === true` on the very next
        // render (refs are synchronous; state is not).
        hasSavedRef.current = true
        captureActions.reset()
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Could not save the card.')
      } finally {
        setSaving(false)
      }
      return
    }

    // mode === 'editing-saved'
    if (savedCardId === null || savedVersion === null) {
      setSaving(false)
      return
    }
    try {
      let workingVersion = savedVersion
      if (deckId !== savedDeckId) {
        const moved = await moveCardAction(savedCardId, deckId)
        workingVersion = moved.version
        setSavedDeckId(moved.deckId)
        setSavedVersion(moved.version)
      }
      const tagList = parseList(fields.tags)
      // The Record<string, unknown> shape from `buildFieldsData` matches the
      // vocabulary arm of the FieldsData union at runtime — same justification
      // as the cast inside `buildPreviewCard` above. The double-cast routes
      // through `unknown` because the wire type is the tight Zod-inferred union.
      const payload = {
        fieldsData: buildFieldsData(fields) as unknown,
        layoutType: 'vocabulary' as const,
        tags:       tagList,
        jlptLevel:  fields.jlptLevel === '' ? null : fields.jlptLevel,
      } as unknown as Parameters<typeof updateCardAction>[2]
      const result = await updateCardAction(savedCardId, workingVersion, payload)
      if (result.ok) {
        setSavedVersion(result.card.version)
        setSaved({ count: 1, deckName: deckName ?? 'your deck' })
        setUpdateStatus('updated')
      } else {
        // 412 If-Match conflict — server's version of the card has advanced
        // since this user's last read. Discard local edits, reseed, and let
        // the user re-apply on top of fresh truth.
        await reseedFromServer(savedCardId)
        setUpdateStatus('conflict')
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Could not update the card.')
    } finally {
      setSaving(false)
    }
  }, [canSave, deckId, fields, deckName, captureActions, mode, savedCardId, savedVersion, savedDeckId, reseedFromServer])

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
  // Only short-circuit on noDraft *before* a save has happened. After save,
  // captureActions.reset() empties the draft intentionally — letting the
  // loading stub steal the render would hide the SuccessBlock entirely.
  if (noDraft && saved === null) return <div className="px-6 pt-16 text-sm text-faded-sumi" role="status">Loading…</div>

  // SuccessBlock is the terminal celebratory state — shown only while we
  // remain in 'creating' mode. 'editing-saved' keeps `saved` set (so
  // savedCardId/version are populated and the cheap regen branch fires)
  // but re-renders the form so the user can tweak.
  if (saved !== null && mode === 'creating') {
    return (
      <Frame>
        <SuccessBlock
          count={saved.count}
          deckName={saved.deckName}
          onAddAnother={() => startNav(() => router.push('/add'))}
          onReturnToToday={() => startNav(() => router.push('/today'))}
          onTweak={() => {
            setMode('editing-saved')
            setUpdateStatus('idle')
            setSaveError(null)
            // Move focus to the page header so screen-reader users get
            // the mode change announced as a meaningful landmark
            // (CODING_STANDARDS_FRONTEND.md: "Route changes move focus
            // to a meaningful landmark"). Defer to next tick so the
            // re-render has mounted the header.
            requestAnimationFrame(() => headerRef.current?.focus())
          }}
        />
      </Frame>
    )
  }

  const header = mode === 'editing-saved'
    ? {
        kanji:    '直',
        label:    'Editing saved card',
        title:    'Tweak and update.',
        subtitle: 'Your changes will overwrite the saved card. Cheap regenerations are available below.',
      }
    : isAiPath
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

  const saveLabel = mode === 'editing-saved' ? 'Update card' : 'Save card'

  return (
    <Frame>
      {/* tabIndex={-1} makes the header a programmatic focus target without
          putting it in the Tab sequence — used by the 'Tweak this card'
          handler so the mode change has a screen-reader-meaningful landing. */}
      <div ref={headerRef} tabIndex={-1} className="outline-none">
        <PageHeader kanji={header.kanji} label={header.label} title={header.title} subtitle={header.subtitle} />
      </div>

      <SectionEyebrow />

      {/* Two-column desktop (6/6): field SectionCards left, preview + Save right. */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-10">
        {/* Left: field SectionCards */}
        <div className="lg:col-span-6 flex flex-col gap-6 lg:gap-7">
          <DeckCard
            options={deckOptions}
            value={deckId}
            onChange={setDeckId}
            loading={decksQuery.isLoading}
            deckName={deckName}
          />

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

        {/* Right: preview + Save action, paired so the act of saving sits
            beside the artifact being saved. Sticky on lg so the preview
            and CTA travel with the editor as the form scrolls. */}
        <aside className="lg:col-span-6 lg:sticky lg:top-10 lg:self-start flex flex-col gap-6">
          <PreviewBlock
            card={previewCard}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            loading={generating}
            aiError={aiError}
          />
          <SaveBlock
            saveLabel={saveLabel}
            canSave={canSave}
            saving={saving}
            blockers={blockers}
            saveError={saveError}
            onSave={onSave}
            mode={mode}
            updateStatus={updateStatus}
          />
        </aside>
      </div>
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

function DeckCard({ options, value, onChange, loading, deckName }: DeckCardProps): React.JSX.Element {
  const empty = value === null
  return (
    <SectionCard
      kanji="組"
      label="Deck"
      description={
        empty
          ? 'Pick where this card will live.'
          : `This card will be saved to ${deckName ?? 'your selected deck'}.`
      }
    >
      <div className="flex flex-col gap-2 pt-1">
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
        {empty && (
          <p
            role="status"
            className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-error"
          >
            Required · pick a deck before saving.
          </p>
        )}
      </div>
    </SectionCard>
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
  const flipToggle = (
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
//
// Inline action under the preview — no SectionCard wrapper. The preview is
// the artifact, this is the verb. A single status line above the button
// names the load-bearing blocker (or confirms readiness) so the requirement
// stays visible without competing for attention.

interface SaveBlockProps {
  saveLabel:    string
  canSave:      boolean
  saving:       boolean
  blockers:     string[]
  saveError:    string | null
  onSave:       () => void
  mode:         'creating' | 'editing-saved'
  updateStatus: 'idle' | 'updated' | 'conflict'
}

function SaveBlock({
  saveLabel, canSave, saving, blockers, saveError, onSave, mode, updateStatus,
}: SaveBlockProps): React.JSX.Element {
  // Status line precedence:
  //   blockers > saveError (handled below) > updateStatus (post-PATCH) > mode default.
  // The post-update line is rendered as a separate `role="status"` paragraph so
  // a screen reader announces it without depending on whether blockers cleared.
  const idleLine = mode === 'editing-saved' ? 'Editing saved card.' : 'Ready to save.'
  return (
    <div className="flex flex-col gap-3 px-1">
      {blockers.length > 0 ? (
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi" role="status">
          {blockers[0]}
        </p>
      ) : updateStatus === 'updated' ? (
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-matcha-green" role="status">
          Updated.
        </p>
      ) : updateStatus === 'conflict' ? (
        <p className="text-sm text-error" role="alert">
          Someone else updated this card. Your unsaved edits were replaced with the latest version.
        </p>
      ) : (
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faded-sumi">
          {idleLine}
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onSave}
        disabled={!canSave}
        loading={saving}
        className="w-full"
      >
        {saveLabel}
      </Button>
      {saveError !== null && (
        <p className="text-sm text-error" role="alert">{saveError}</p>
      )}
    </div>
  )
}

// ── Success ───────────────────────────────────────────────────────────────────

interface SuccessBlockProps {
  count:           number
  deckName:        string
  onAddAnother:    () => void
  onReturnToToday: () => void
  onTweak:         () => void
}

function SuccessBlock({ count, deckName, onAddAnother, onReturnToToday, onTweak }: SuccessBlockProps): React.JSX.Element {
  const cardsWord = count === 1 ? 'card' : 'cards'
  return (
    <SectionCard kanji="済" label="Saved">
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.05] text-sumi-ink">
            Saved {count} {cardsWord} to {deckName}.
          </h1>
          <p className="mt-3 max-w-[55ch] text-base text-faded-sumi leading-relaxed">
            You can keep adding, tweak what you just saved, or return to Today.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <Button variant="primary" size="lg" onClick={onAddAnother} autoFocus>
              Add another
            </Button>
            <Button variant="editorial" size="lg" onClick={onTweak}>
              Tweak this card
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

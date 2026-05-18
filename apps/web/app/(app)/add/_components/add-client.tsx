'use client'

import {
  useCallback,
  useId,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { Textarea } from '@/components/ui/Textarea'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar'
import { useDecks } from '@/lib/api/decks'
import {
  useCaptureDraftActions,
  type CaptureDraft,
  type CaptureMode,
} from '@/stores/useCaptureDraftStore'

import { AddSessionPreview, isTargetMissingFromSentence } from './add-session-preview'

// ── Errors ────────────────────────────────────────────────────────────────────
//
// Validation runs on submit (either Generate or Manual). Missing required
// fields are surfaced inline below their field. Editing a field clears its
// error so the user gets responsive feedback as they fix the form.

interface FormErrors {
  word:     string | null
  sentence: string | null
  deck:     string | null
}

const NO_ERRORS: FormErrors = { word: null, sentence: null, deck: null }

// ── Add client ────────────────────────────────────────────────────────────────

interface AddClientProps {
  /** Stable date key (yyyy-mm-dd) for seeding the preview empty-state quote. */
  todayKey: string
}

export function AddClient({ todayKey }: AddClientProps): React.JSX.Element {
  const router          = useRouter()
  const [, startNav]    = useTransition()
  const captureActions  = useCaptureDraftActions()

  // ── Required fields ─────────────────────────────────────────────────────
  const [word,     setWord]     = useState<string>('')
  const [sentence, setSentence] = useState<string>('')
  const [deckId,   setDeckId]   = useState<string | null>(null)

  // ── UX state ────────────────────────────────────────────────────────────
  const [errors,     setErrors]     = useState<FormErrors>(NO_ERRORS)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitMode, setSubmitMode] = useState<CaptureMode | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────
  const trimmedWord     = word.trim()
  const trimmedSentence = sentence.trim()
  const targetMissing   = isTargetMissingFromSentence(trimmedWord, trimmedSentence)

  // ── Decks ───────────────────────────────────────────────────────────────
  const decksQuery = useDecks(50)
  const deckOptions = useMemo<ReadonlyArray<TomoSelectOption<string>>>(() => {
    const items = decksQuery.data?.items ?? []
    return items.map((d) => ({
      value: d.id,
      label: d.name.trim().length > 0 ? d.name : 'Untitled deck',
    }))
  }, [decksQuery.data])

  const noDecks = !decksQuery.isLoading && deckOptions.length === 0

  // ── Field setters that also clear their error ───────────────────────────
  const updateWord = useCallback((next: string): void => {
    setWord(next)
    setErrors((prev) => (prev.word === null ? prev : { ...prev, word: null }))
  }, [])

  const updateSentence = useCallback((next: string): void => {
    setSentence(next)
    setErrors((prev) => (prev.sentence === null ? prev : { ...prev, sentence: null }))
  }, [])

  const updateDeck = useCallback((next: string): void => {
    setDeckId(next)
    setErrors((prev) => (prev.deck === null ? prev : { ...prev, deck: null }))
  }, [])

  // ── Validate + submit ───────────────────────────────────────────────────
  const validate = useCallback((): FormErrors => {
    return {
      word:     trimmedWord.length === 0     ? 'Add a word or phrase.'    : null,
      sentence: trimmedSentence.length === 0 ? 'Add an example sentence.' : null,
      deck:     deckId === null              ? 'Pick a deck to save into.': null,
    }
  }, [trimmedWord, trimmedSentence, deckId])

  const submit = useCallback((mode: CaptureMode) => {
    if (submitting) return
    const next = validate()
    if (next.word !== null || next.sentence !== null || next.deck !== null) {
      setErrors(next)
      return
    }
    setErrors(NO_ERRORS)

    const draft: CaptureDraft = {
      word:         trimmedWord,
      sentence:     trimmedSentence,
      mode,
      reading:      '',
      meaning:      '',
      mnemonic:     '',
      note:         '',
      deckId,
      source:       '',
      imageName:    null,
      imageDataUrl: null,
      updatedAt:    Date.now(),
    }
    captureActions.setDraft(draft)

    // Only the Generate path actually does work downstream (AI call on
    // /add/review). Manual is a pure handoff to a blank edit form, so don't
    // simulate progress for it: just route. The loading state is reserved for
    // paths that legitimately take time.
    if (mode === 'generate') {
      setSubmitMode('generate')
      setSubmitting(true)
    }

    startNav(() => router.push('/add/review'))
  }, [submitting, validate, trimmedWord, trimmedSentence, deckId, captureActions, router])

  const onGenerate = useCallback(() => submit('generate'), [submit])
  const onManual   = useCallback(() => submit('manual'),   [submit])

  const cancelSubmit = useCallback(() => {
    setSubmitting(false)
    setSubmitMode(null)
  }, [])

  // ── Action area (shared between desktop sibling and mobile bar) ─────────
  const actions = (
    <ActionArea
      submitting={submitting}
      activeMode={submitMode}
      onGenerate={onGenerate}
      onManual={onManual}
      onCancel={cancelSubmit}
    />
  )

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div className="relative z-10 grid flex-1 grid-cols-1 content-center gap-y-8 mx-auto w-full max-w-[1440px] px-6 pt-8 md:px-12 md:pt-10 lg:px-16 lg:pt-12">
        <PageHeader
          kanji="採"
          label="Capture"
          title="Save what you found."
          subtitle="Tomo adds context, you stay in the moment."
        />

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          {/* Left: required form (back-of-card capture moved to /add/review) */}
          <div className="lg:col-span-6">
            <SectionCard
              id="add-form"
              kanji="記"
              label="Write it down"
              description="Three fields make a card."
              stripeTone="brand"
            >
              <form
                className="flex flex-col gap-7 pt-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  onGenerate()
                }}
                noValidate
              >
                <Input
                  label="Word or phrase"
                  value={word}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateWord(e.target.value)}
                  placeholder="e.g. 木漏れ日"
                  script="mixed"
                  size="lg"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  error={errors.word ?? undefined}
                />

                <Textarea
                  label="Example sentence"
                  value={sentence}
                  onChange={(e) => updateSentence(e.target.value)}
                  placeholder="今日は木漏れ日だから、人が少ない。"
                  script="mixed"
                  block
                  rows={4}
                  hint={
                    errors.sentence === null
                      ? 'A sentence where the word appears. Helps Tomo pick the right meaning.'
                      : undefined
                  }
                  error={errors.sentence ?? undefined}
                />

                <DeckField
                  options={deckOptions}
                  value={deckId}
                  onChange={updateDeck}
                  loading={decksQuery.isLoading}
                  noDecks={noDecks}
                  error={errors.deck}
                />

                <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
                  Generate card
                </button>
              </form>
            </SectionCard>
          </div>

          {/* Right: session-faithful preview + sibling action block */}
          <aside className="lg:col-span-6 lg:sticky lg:top-10 lg:self-start flex flex-col gap-5">
            <AddSessionPreview
              word={trimmedWord}
              sentence={trimmedSentence}
              todayKey={todayKey}
              dimmed={submitting}
              targetMissing={targetMissing}
            />

            <div className="hidden lg:block">{actions}</div>
          </aside>
        </div>
      </div>

      <MobileStickyActionBar ariaLabel="Create card">
        {actions}
      </MobileStickyActionBar>
    </div>
  )
}

// ── Deck field (uses TomoSelect to match the Settings dropdown register) ─────

interface DeckFieldProps {
  options:  ReadonlyArray<TomoSelectOption<string>>
  value:    string | null
  onChange: (next: string) => void
  loading:  boolean
  noDecks:  boolean
  error:    string | null
}

function DeckField({
  options, value, onChange, loading, noDecks, error,
}: DeckFieldProps): React.JSX.Element {
  const id = useId()
  const labelId = `${id}-label`
  const hintId  = `${id}-hint`
  const errId   = `${id}-error`

  const hint = loading
    ? 'Loading your decks…'
    : noDecks
      ? undefined
      : 'The card will live in this deck.'

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-sumi-ink/85">Deck</span>

      <TomoSelect<string>
        id={id}
        value={value ?? ''}
        options={options}
        onValueChange={onChange}
        ariaLabelledBy={labelId}
        placeholder="Choose a deck…"
        disabled={loading || noDecks}
      />

      {error !== null ? (
        <p id={errId} role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : (
        hint !== undefined && (
          <p id={hintId} className="text-sm text-faded-sumi">{hint}</p>
        )
      )}

      {noDecks && (
        <p className="text-sm text-faded-sumi">
          No decks yet.{' '}
          <QuietLink href="/decks" tone="brand" size="sm">Create a deck</QuietLink>{' '}
          to get started.
        </p>
      )}
    </div>
  )
}

// ── Action area ──────────────────────────────────────────────────────────────

interface ActionAreaProps {
  submitting: boolean
  activeMode: CaptureMode | null
  onGenerate: () => void
  onManual:   () => void
  onCancel:   () => void
}

function ActionArea({
  submitting, activeMode, onGenerate, onManual, onCancel,
}: ActionAreaProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
      {submitting && (
        <QuietLink
          onClick={onCancel}
          tone="sumi"
          size="sm"
          ariaLabel="Cancel card creation"
        >
          Cancel
        </QuietLink>
      )}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={onManual}
        disabled={submitting && activeMode !== 'manual'}
        loading={submitting && activeMode === 'manual'}
        className="w-full sm:w-auto"
      >
        Add manually
      </Button>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onGenerate}
        disabled={submitting && activeMode !== 'generate'}
        loading={submitting && activeMode === 'generate'}
        className="w-full sm:w-auto sm:min-w-[180px]"
      >
        Generate card
      </Button>
    </div>
  )
}

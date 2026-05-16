'use client'

import {
  useCallback,
  useEffect,
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
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar'
import { useDecks } from '@/lib/api/decks'
import {
  useCaptureDraftActions,
  type CaptureDraft,
} from '@/stores/useCaptureDraftStore'

import { AddOptionalCard, type AddOptionalValues } from './add-optional-card'
import { AddSessionPreview, isTargetMissingFromSentence } from './add-session-preview'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB; preview-only, never uploaded yet.

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

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

  // ── Optional fields (back-of-card + personal) ───────────────────────────
  const [optional, setOptional] = useState<AddOptionalValues>({
    reading:      '',
    meaning:      '',
    mnemonic:     '',
    note:         '',
    source:       '',
    imageName:    null,
    imageDataUrl: null,
  })
  const [imageError, setImageError] = useState<string | null>(null)

  // ── UX state ────────────────────────────────────────────────────────────
  const [showSentenceWarning, setShowSentenceWarning] = useState<boolean>(false)
  const [submitting,           setSubmitting]           = useState<boolean>(false)

  // ── Derived ─────────────────────────────────────────────────────────────
  const trimmedWord     = word.trim()
  const trimmedSentence = sentence.trim()
  const wordPresent     = trimmedWord.length     > 0
  const sentencePresent = trimmedSentence.length > 0
  const deckPresent     = deckId !== null
  const canSubmit       = wordPresent && deckPresent

  const targetMissing = isTargetMissingFromSentence(trimmedWord, trimmedSentence)
  // The preview footnote handles target-not-found; the form-level warning is
  // strictly for "no sentence at all" and stays suppressed when the preview
  // already telegraphs the issue.
  const showFormSentenceWarning = showSentenceWarning && !sentencePresent && !targetMissing

  // ── Decks ───────────────────────────────────────────────────────────────
  const decksQuery = useDecks(50)
  const deckOptions = useMemo(() => {
    const items = decksQuery.data?.items ?? []
    return [
      { value: '', label: 'Choose a deck…' },
      ...items.map((d) => ({
        value: d.id,
        label: d.name.trim().length > 0 ? d.name : 'Untitled deck',
      })),
    ]
  }, [decksQuery.data])

  const noDecks = !decksQuery.isLoading && (decksQuery.data?.items ?? []).length === 0

  // ── Optional change handlers ────────────────────────────────────────────
  const updateOptional = useCallback(
    <K extends keyof AddOptionalValues>(key: K, value: AddOptionalValues[K]): void => {
      setOptional((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handlePickImage = useCallback(async (file: File): Promise<void> => {
    setImageError(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 5MB or smaller.')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setOptional((prev) => ({ ...prev, imageName: file.name, imageDataUrl: dataUrl }))
    } catch {
      setImageError('Could not read that image. Try another file.')
    }
  }, [])

  const handleClearImage = useCallback((): void => {
    setOptional((prev) => ({ ...prev, imageName: null, imageDataUrl: null }))
    setImageError(null)
  }, [])

  // ── Submit ──────────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    if (!canSubmit || submitting) return
    setSubmitting(true)

    const draft: CaptureDraft = {
      word:         trimmedWord,
      sentence:     trimmedSentence,
      reading:      optional.reading.trim(),
      meaning:      optional.meaning.trim(),
      mnemonic:     optional.mnemonic.trim(),
      note:         optional.note.trim(),
      deckId,
      source:       optional.source.trim(),
      cardType:     'auto',
      imageName:    optional.imageName,
      imageDataUrl: optional.imageDataUrl,
      updatedAt:    Date.now(),
    }
    captureActions.setDraft(draft)
    startNav(() => router.push('/add/review'))
  }, [
    canSubmit, submitting, trimmedWord, trimmedSentence, deckId, optional,
    captureActions, router,
  ])

  const cancelSubmit = useCallback(() => setSubmitting(false), [])

  // ── Sentence warning gate ───────────────────────────────────────────────
  useEffect(() => {
    if (sentencePresent) setShowSentenceWarning(false)
  }, [sentencePresent])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const submitCombo = (e.metaKey || e.ctrlKey) && e.key === 'Enter'
      if (!submitCombo) return
      if (!canSubmit) return
      e.preventDefault()
      if (!sentencePresent) {
        setShowSentenceWarning(true)
        return
      }
      submit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canSubmit, sentencePresent, submit])

  const handleSentenceBlur = useCallback(() => {
    if (wordPresent && !sentencePresent) setShowSentenceWarning(true)
  }, [wordPresent, sentencePresent])

  const [warningArmed, setWarningArmed] = useState<boolean>(false)
  useEffect(() => {
    if (!showSentenceWarning) {
      setWarningArmed(false)
      return
    }
    const id = window.setTimeout(() => setWarningArmed(true), 0)
    return () => window.clearTimeout(id)
  }, [showSentenceWarning])

  const handlePrimaryClickArmed = useCallback(() => {
    if (!canSubmit) return
    if (sentencePresent) {
      submit()
      return
    }
    if (!showSentenceWarning) {
      setShowSentenceWarning(true)
      return
    }
    if (warningArmed) submit()
  }, [canSubmit, sentencePresent, showSentenceWarning, warningArmed, submit])

  // ── Action area (shared between desktop sibling and mobile bar) ─────────
  const actions = (
    <ActionArea
      disabled={!canSubmit}
      submitting={submitting}
      onSubmit={handlePrimaryClickArmed}
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
          {/* Left: stacked required + optional cards */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Required */}
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
                  handlePrimaryClickArmed()
                }}
                noValidate
              >
                <Input
                  label="Word or phrase"
                  value={word}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setWord(e.target.value)}
                  placeholder="e.g. 木漏れ日"
                  script="mixed"
                  size="lg"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />

                <Textarea
                  label="Example sentence"
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  onBlur={handleSentenceBlur}
                  placeholder="今日は木漏れ日だから、人が少ない。"
                  script="mixed"
                  block
                  rows={4}
                  hint={
                    !sentencePresent && !showFormSentenceWarning
                      ? 'A sentence where the word appears. Helps Tomo pick the right meaning.'
                      : undefined
                  }
                />

                {showFormSentenceWarning && <SentenceWarning />}

                <DeckField
                  decks={deckOptions}
                  value={deckId}
                  onChange={setDeckId}
                  loading={decksQuery.isLoading}
                  noDecks={noDecks}
                  showRequiredHint={wordPresent && !deckPresent}
                />

                <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
                  Create card
                </button>
              </form>
            </SectionCard>

            {/* Optional (Tabs) */}
            <AddOptionalCard
              values={optional}
              errors={{ imageError }}
              onChange={updateOptional}
              onPickImageFile={handlePickImage}
              onClearImage={handleClearImage}
            />
          </div>

          {/* Right: session-faithful preview + sibling action block */}
          <aside className="lg:col-span-6 lg:sticky lg:top-10 lg:self-start flex flex-col gap-5">
            <AddSessionPreview
              word={trimmedWord}
              sentence={trimmedSentence}
              reading={optional.reading.trim()}
              meaning={optional.meaning.trim()}
              pictureDataUrl={optional.imageDataUrl}
              todayKey={todayKey}
              dimmed={submitting}
              targetMissing={targetMissing}
            />

            <div className="hidden lg:flex items-center justify-between gap-4">
              <p
                aria-hidden="true"
                className="font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi"
              >
                ⌘ ⏎ to create
              </p>
              {actions}
            </div>
          </aside>
        </div>
      </div>

      <MobileStickyActionBar ariaLabel="Create card">
        {actions}
      </MobileStickyActionBar>
    </div>
  )
}

// ── Deck field ────────────────────────────────────────────────────────────────

interface DeckFieldProps {
  decks:             ReadonlyArray<{ value: string; label: string }>
  value:             string | null
  onChange:          (next: string | null) => void
  loading:           boolean
  noDecks:           boolean
  showRequiredHint:  boolean
}

function DeckField({
  decks, value, onChange, loading, noDecks, showRequiredHint,
}: DeckFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <Select
        label="Deck"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        options={[...decks]}
        disabled={loading || noDecks}
        hint={
          loading
            ? 'Loading your decks…'
            : noDecks
              ? undefined
              : showRequiredHint
                ? 'Pick a deck to save into.'
                : 'The card will live in this deck.'
        }
      />
      {noDecks && (
        <p className="text-sm text-faded-sumi">
          No decks yet. <QuietLink href="/decks" tone="brand" size="sm">Create a deck</QuietLink> to get started.
        </p>
      )}
    </div>
  )
}

// ── Action area ──────────────────────────────────────────────────────────────

interface ActionAreaProps {
  disabled:   boolean
  submitting: boolean
  onSubmit:   () => void
  onCancel:   () => void
}

function ActionArea({ disabled, submitting, onSubmit, onCancel }: ActionAreaProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-3">
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
          variant="primary"
          size="lg"
          disabled={disabled}
          loading={submitting}
          onClick={onSubmit}
          className="w-full sm:min-w-[180px]"
        >
          {submitting ? 'Building card' : 'Create card'}
        </Button>
      </div>
    </div>
  )
}

// ── Sentence warning ──────────────────────────────────────────────────────────

function SentenceWarning(): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-[2px] border border-soft-hairline bg-cream-inset/70 px-3 py-2.5"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-faded-sumi/50 text-[10px] font-medium text-faded-sumi"
      >
        i
      </span>
      <p className="text-sm leading-6 text-sumi-ink/80">
        No sentence yet. Tomo will pick a default meaning. Sentence context
        produces a more personal card. Tap{' '}
        <span className="font-medium text-sumi-ink">Create card</span> again to
        continue without one.
      </p>
    </div>
  )
}

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

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ExitLinksRow } from '@/app/(app)/_components/exit-links-row'
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar'
import { useDecks } from '@/lib/api/decks'
import {
  useCaptureDraftActions,
  type CaptureCardType,
  type CaptureDraft,
} from '@/stores/useCaptureDraftStore'

import { AddChipRow, type AddChipDescriptor } from './add-chip-row'
import { AddPreviewCard, type CaptureCount } from './add-preview-card'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_TYPE_OPTIONS: ReadonlyArray<{ value: CaptureCardType; label: string }> = [
  { value: 'auto',          label: 'Suggest for me' },
  { value: 'comprehension', label: 'Recognize (J → meaning)' },
  { value: 'production',    label: 'Produce (meaning → J)' },
  { value: 'listening',     label: 'Listen (audio → meaning)' },
]

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB; preview-only, never uploaded yet.

// Today / This-week capture counts. We don't currently have a user-scoped
// "list my recent cards" endpoint; render `—` until one exists. The brief
// approves this fallback.
const TODAY_COUNT: CaptureCount = null
const WEEK_COUNT:  CaptureCount = null

const EXIT_LINKS = [
  { href: '/decks',             label: 'Manage decks'           },
  { href: '/insights/progress', label: "See how you're trending" },
  { href: '/today',             label: 'Back to today'          },
] as const

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
  /** Stable date key (yyyy-mm-dd) for seeding the empty-state quote. */
  todayKey: string
}

export function AddClient({ todayKey }: AddClientProps): React.JSX.Element {
  const router          = useRouter()
  const [, startNav]    = useTransition()
  const captureActions  = useCaptureDraftActions()

  // ── Form state ──────────────────────────────────────────────────────────
  const [word,         setWord]         = useState<string>('')
  const [sentence,     setSentence]     = useState<string>('')
  const [note,         setNote]         = useState<string>('')
  const [deckId,       setDeckId]       = useState<string | null>(null)
  const [source,       setSource]       = useState<string>('')
  const [cardType,     setCardType]     = useState<CaptureCardType>('auto')
  const [imageName,    setImageName]    = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageError,   setImageError]   = useState<string | null>(null)

  const [activeChip,   setActiveChip]   = useState<string | null>(null)
  const [showSentenceWarning, setShowSentenceWarning] = useState<boolean>(false)
  const [submitting,   setSubmitting]   = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────
  const trimmedWord     = word.trim()
  const trimmedSentence = sentence.trim()
  const wordPresent     = trimmedWord.length     > 0
  const sentencePresent = trimmedSentence.length > 0

  const decksQuery = useDecks(50)
  const deckOptions = useMemo(() => {
    const items = decksQuery.data?.items ?? []
    return [
      { value: '', label: 'No deck yet — Tomo will suggest one' },
      ...items.map((d) => ({
        value: d.id,
        label: d.name.trim().length > 0 ? d.name : 'Untitled deck',
      })),
    ]
  }, [decksQuery.data])

  const chips: ReadonlyArray<AddChipDescriptor> = useMemo(() => [
    {
      id: 'image',
      label: 'Image',
      filled: imageName !== null,
      render: () => (
        <ImageEditor
          imageName={imageName}
          imageDataUrl={imageDataUrl}
          imageError={imageError}
          fileInputRef={fileInputRef}
          onPickFile={() => fileInputRef.current?.click()}
          onClear={() => {
            setImageName(null)
            setImageDataUrl(null)
            setImageError(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
          onChangeFile={async (file) => {
            setImageError(null)
            if (file.size > MAX_IMAGE_BYTES) {
              setImageError('Image must be 5MB or smaller.')
              return
            }
            try {
              const dataUrl = await readFileAsDataUrl(file)
              setImageName(file.name)
              setImageDataUrl(dataUrl)
            } catch {
              setImageError('Could not read that image. Try another file.')
            }
          }}
        />
      ),
    },
    {
      id: 'note',
      label: 'Note',
      filled: note.trim().length > 0,
      render: () => (
        <Textarea
          label="Note to yourself"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="A reminder, a pun, why this word stuck."
          hint="Visible only to you. Carries through to the card."
        />
      ),
    },
    {
      id: 'deck',
      label: 'Deck',
      filled: deckId !== null,
      render: () => (
        <Select
          label="Deck"
          value={deckId ?? ''}
          onChange={(e) => setDeckId(e.target.value === '' ? null : e.target.value)}
          options={deckOptions}
          hint={
            decksQuery.isLoading
              ? 'Loading your decks…'
              : 'Leave unset to let Tomo suggest one based on context.'
          }
        />
      ),
    },
    {
      id: 'source',
      label: 'Source',
      filled: source.trim().length > 0,
      render: () => (
        <Input
          label="Source (book, episode, URL)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. NHK Easy, よつばと! ch.3"
          autoComplete="off"
        />
      ),
    },
    {
      id: 'card-type',
      label: 'Card type',
      filled: cardType !== 'auto',
      render: () => (
        <Select
          label="Card type preference"
          value={cardType}
          onChange={(e) => setCardType(e.target.value as CaptureCardType)}
          options={[...CARD_TYPE_OPTIONS]}
          hint="Auto picks the best modality for the word."
        />
      ),
    },
  ], [imageName, imageDataUrl, imageError, note, deckId, deckOptions, decksQuery.isLoading, source, cardType])

  // ── Submit ──────────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    if (!wordPresent || submitting) return
    setSubmitting(true)

    const draft: CaptureDraft = {
      word:         trimmedWord,
      sentence:     trimmedSentence,
      note:         note.trim(),
      deckId,
      source:       source.trim(),
      cardType,
      // Image preview is held client-side only. The downstream create-card
      // call deliberately omits it from the request body in this iteration.
      imageName,
      imageDataUrl,
      updatedAt:    Date.now(),
    }
    captureActions.setDraft(draft)
    startNav(() => router.push('/add/review'))
  }, [
    wordPresent, submitting, trimmedWord, trimmedSentence, note, deckId, source,
    cardType, imageName, imageDataUrl, captureActions, router,
  ])

  const cancelSubmit = useCallback(() => {
    setSubmitting(false)
  }, [])

  // ── Sentence warning gate ───────────────────────────────────────────────
  // The preview already telegraphs target-not-found, so we only surface the
  // form-level "no sentence" warning when sentence is *empty*. Two-click gate:
  // first click surfaces the warning, second click submits anyway.
  useEffect(() => {
    if (sentencePresent) setShowSentenceWarning(false)
  }, [sentencePresent])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const submitCombo = (e.metaKey || e.ctrlKey) && e.key === 'Enter'
      if (!submitCombo) return
      if (!wordPresent) return
      e.preventDefault()
      if (!sentencePresent) {
        setShowSentenceWarning(true)
        return
      }
      submit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [wordPresent, sentencePresent, submit])

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
    if (!wordPresent) return
    if (sentencePresent) {
      submit()
      return
    }
    if (!showSentenceWarning) {
      setShowSentenceWarning(true)
      return
    }
    if (warningArmed) submit()
  }, [wordPresent, sentencePresent, showSentenceWarning, warningArmed, submit])

  // ── Action area (shared between sticky aside and mobile bar) ────────────
  const actions = (
    <ActionArea
      disabled={!wordPresent}
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
          {/* Left: sticky preview aside */}
          <aside className="lg:col-span-5 lg:sticky lg:top-10 lg:self-start">
            <AddPreviewCard
              word={trimmedWord}
              sentence={trimmedSentence}
              todayKey={todayKey}
              todayCount={TODAY_COUNT}
              weekCount={WEEK_COUNT}
              dimmed={submitting}
              actions={actions}
            />
          </aside>

          {/* Right: form card */}
          <div className="lg:col-span-7">
            <SectionCard
              id="add-form"
              kanji="記"
              label="Write it down"
              description="Sentence carries the meaning. Optional details make the card more yours."
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
                  label="Word"
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
                  label="Where you found it"
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  onBlur={handleSentenceBlur}
                  placeholder="今日は木漏れ日だから、人が少ない。"
                  script="mixed"
                  block
                  rows={4}
                  hint={
                    !sentencePresent && !showSentenceWarning
                      ? 'Sentence helps Tomo pick the right meaning.'
                      : undefined
                  }
                />

                {showSentenceWarning && !sentencePresent && <SentenceWarning />}

                <AddChipRow
                  chips={chips}
                  activeId={activeChip}
                  onToggle={(id) => setActiveChip((cur) => (cur === id ? null : id))}
                />

                <p
                  aria-hidden="true"
                  className="hidden lg:block font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi"
                >
                  ⌘ ⏎ to create
                </p>

                {/* Submit button kept inside the form for native Enter/submit
                    semantics, but visually hidden at lg+ where the sticky
                    aside owns the primary action. */}
                <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
                  Create card
                </button>
              </form>
            </SectionCard>
          </div>
        </div>

        <ExitLinksRow links={EXIT_LINKS} />
      </div>

      <MobileStickyActionBar ariaLabel="Create card">
        {actions}
      </MobileStickyActionBar>
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

// ── Image editor (chip-promoted) ──────────────────────────────────────────────

interface ImageEditorProps {
  imageName:     string | null
  imageDataUrl:  string | null
  imageError:    string | null
  fileInputRef:  React.RefObject<HTMLInputElement | null>
  onPickFile:    () => void
  onClear:       () => void
  onChangeFile:  (file: File) => void | Promise<void>
}

function ImageEditor({
  imageName, imageDataUrl, imageError, fileInputRef, onPickFile, onClear, onChangeFile,
}: ImageEditorProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-sumi-ink/85">Image</span>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onChangeFile(file)
        }}
      />

      {imageDataUrl !== null && imageName !== null ? (
        <div className="flex items-center gap-3 rounded-[2px] border border-soft-hairline bg-cream-inset px-3 py-2">
          {/* Preview is a local data URL, never persisted or uploaded here. */}
          <img
            src={imageDataUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-[2px] object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-sumi-ink">{imageName}</span>
            <span className="text-xs text-faded-sumi">Preview only, image upload coming soon.</span>
          </div>
          <QuietLink onClick={onClear} tone="sumi" size="sm">Remove</QuietLink>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPickFile}
            className="ui-motion-colors inline-flex items-center gap-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-2 text-sm text-sumi-ink hover:bg-cream-inset hover:border-faded-sumi focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            Choose file…
          </button>
          <span className="text-xs text-faded-sumi">PNG, JPG, WebP, GIF up to 5MB.</span>
        </div>
      )}

      {imageError !== null && (
        <p role="alert" className="text-sm text-error">{imageError}</p>
      )}
    </div>
  )
}

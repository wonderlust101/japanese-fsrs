'use client'

import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react'

import { Input } from '@/components/ui/Input'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Textarea'

// ── Types ─────────────────────────────────────────────────────────────────────

type OptionalTabValue = 'back-of-card' | 'your-notes'

export interface AddOptionalValues {
  reading:      string
  meaning:      string
  mnemonic:     string
  note:         string
  source:       string
  imageName:    string | null
  imageDataUrl: string | null
}

export interface AddOptionalErrors {
  imageError: string | null
}

interface AddOptionalCardProps {
  values: AddOptionalValues
  errors: AddOptionalErrors
  onChange: <K extends keyof AddOptionalValues>(key: K, value: AddOptionalValues[K]) => void
  onPickImageFile: (file: File) => void | Promise<void>
  onClearImage:    () => void
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// ── Component ─────────────────────────────────────────────────────────────────
//
// The optional-fields card. Mirrors the SetupControls pattern (Tabs inside a
// SectionCard, badge counts per tab) so /add reads in the same register as
// Review Setup.
//
// Two tabs:
//   - Back of card: fields that surface on the back during review (Reading,
//     Meaning, Mnemonic, Picture). All optional — Tomo fills them otherwise.
//   - Your notes: fields that stay with the learner, never on the back of the
//     card (private Note, provenance Source).

export function AddOptionalCard({
  values,
  errors,
  onChange,
  onPickImageFile,
  onClearImage,
}: AddOptionalCardProps): React.JSX.Element {
  const [tab, setTab] = useState<OptionalTabValue>('back-of-card')

  const backCount = useMemo(() => {
    let n = 0
    if (values.reading.trim().length  > 0) n += 1
    if (values.meaning.trim().length  > 0) n += 1
    if (values.mnemonic.trim().length > 0) n += 1
    if (values.imageName !== null)         n += 1
    return n
  }, [values.reading, values.meaning, values.mnemonic, values.imageName])

  const notesCount = useMemo(() => {
    let n = 0
    if (values.note.trim().length   > 0) n += 1
    if (values.source.trim().length > 0) n += 1
    return n
  }, [values.note, values.source])

  return (
    <SectionCard
      id="add-optional"
      kanji="補"
      label="Add more"
      description="Lock in what you already know. Tomo fills the rest."
      stripeTone="brand"
    >
      <Tabs<OptionalTabValue>
        ariaLabel="Optional capture sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'back-of-card', label: 'Back of card', badge: backCount },
          { value: 'your-notes',   label: 'Your notes',   badge: notesCount },
        ]}
      />

      {tab === 'back-of-card' && (
        <TabPanel>
          <BackOfCardPanel
            values={values}
            errors={errors}
            onChange={onChange}
            onPickImageFile={onPickImageFile}
            onClearImage={onClearImage}
          />
        </TabPanel>
      )}

      {tab === 'your-notes' && (
        <TabPanel>
          <YourNotesPanel values={values} onChange={onChange} />
        </TabPanel>
      )}
    </SectionCard>
  )
}

// ── Panels ────────────────────────────────────────────────────────────────────

interface PanelProps {
  values: AddOptionalValues
  onChange: <K extends keyof AddOptionalValues>(key: K, value: AddOptionalValues[K]) => void
}

interface BackOfCardPanelProps extends PanelProps {
  errors: AddOptionalErrors
  onPickImageFile: (file: File) => void | Promise<void>
  onClearImage:    () => void
}

function BackOfCardPanel({
  values,
  errors,
  onChange,
  onPickImageFile,
  onClearImage,
}: BackOfCardPanelProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Input
        label="Reading"
        value={values.reading}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('reading', e.target.value)}
        placeholder="e.g. こもれび"
        script="kana"
        autoComplete="off"
        spellCheck={false}
        hint="If you already know the kana reading."
      />

      <Input
        label="Meaning"
        value={values.meaning}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('meaning', e.target.value)}
        placeholder="e.g. sunlight filtering through leaves"
        autoComplete="off"
        hint="Short English definition. Otherwise Tomo writes one."
      />

      <Textarea
        label="Mnemonic"
        rows={3}
        value={values.mnemonic}
        onChange={(e) => onChange('mnemonic', e.target.value)}
        placeholder="A memory hook in your own words."
        hint="Your own mnemonics tend to stick best."
      />

      <ImagePicker
        imageName={values.imageName}
        imageDataUrl={values.imageDataUrl}
        imageError={errors.imageError}
        onPickFile={onPickImageFile}
        onClear={onClearImage}
      />
    </div>
  )
}

function YourNotesPanel({ values, onChange }: PanelProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Textarea
        label="Note to yourself"
        rows={3}
        value={values.note}
        onChange={(e) => onChange('note', e.target.value)}
        placeholder="A reminder, a pun, why this word stuck."
        hint="Visible only to you. Never appears on the card."
      />

      <Input
        label="Source"
        value={values.source}
        onChange={(e) => onChange('source', e.target.value)}
        placeholder="Book, episode, URL."
        autoComplete="off"
      />
    </div>
  )
}

// ── Image picker ──────────────────────────────────────────────────────────────

interface ImagePickerProps {
  imageName:    string | null
  imageDataUrl: string | null
  imageError:   string | null
  onPickFile:   (file: File) => void | Promise<void>
  onClear:      () => void
}

function ImagePicker({
  imageName,
  imageDataUrl,
  imageError,
  onPickFile,
  onClear,
}: ImagePickerProps): React.JSX.Element {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-sumi-ink/85">
        Picture
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            if (file.size > MAX_IMAGE_BYTES) return
            void onPickFile(file)
          }
        }}
      />

      {imageDataUrl !== null && imageName !== null ? (
        <div className="flex items-center gap-3 rounded-[2px] border border-soft-hairline bg-cream-inset px-3 py-2">
          {/* Local data URL preview, never uploaded in this iteration. */}
          <img
            src={imageDataUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-[2px] object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-sumi-ink">{imageName}</span>
            <span className="text-xs text-faded-sumi">Preview only, image upload coming soon.</span>
          </div>
          <QuietLink
            onClick={() => {
              if (inputRef.current) inputRef.current.value = ''
              onClear()
            }}
            tone="sumi"
            size="sm"
          >
            Remove
          </QuietLink>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
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

"use client";

// Example-sentence accordion editor (+ in-flight skeleton rows) shared between the
// add-review and edit-card flows. Lifted out of generated-review-client.tsx

import type { ChangeEvent } from "react";
import type { SentenceEntry } from "./types";

import { useState } from "react";
import { QuietLink } from "@/components/ui/QuietLink";
import { Textarea } from "@/components/ui/Textarea";

import { cn } from "@/lib/utils";
import { MAX_SENTENCES, nextRowKey } from "./types";

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
	entries: SentenceEntry[];
	word: string;
	onChange: (next: SentenceEntry[]) => void;
	/** AI per-row regenerate; omitted on the manual path. */
	onRegenerateRow?: (id: string) => void;
	regeneratingId?: string | null;
	/**
	 * Skeleton placeholder rows for an in-flight batch generation, appended
	 *  to the bottom of the list.
	 */
	pendingCount?: number;
}

export function SentenceEditor({
	entries,
	word,
	onChange,
	onRegenerateRow,
	regeneratingId = null,
	pendingCount = 0,
}: SentenceEditorProps): React.JSX.Element {
	// One row open at a time, tracked by id so the open row follows its sentence
	// across add/remove without index bookkeeping.
	const [editingId, setEditingId] = useState<string | null>(null);

	const update = (i: number, patch: Partial<SentenceEntry>): void =>
		onChange(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e));
	// Removing by index is fine — the array is the source of truth. editingId
	// self-corrects: if the open row is the one removed, its id no longer matches
	// and the accordion collapses; otherwise the open row stays open.
	const remove = (i: number): void => onChange(entries.filter((_, idx) => idx !== i));
	const add = (): void => {
		const entry: SentenceEntry = { id: nextRowKey(), ja: "", en: "", furigana: "" };
		onChange([...entries, entry]);
		setEditingId(entry.id);
	};

	const trimmedWord = word.trim();
	const atCap = entries.length >= MAX_SENTENCES;

	return (
		<div className="flex flex-col pt-1">
			{entries.length === 0 && (
				<p className="text-sm text-faded-sumi pb-2">
					No example sentences yet. Add one, or generate a few with AI below.
				</p>
			)}
			{entries.map((entry, i) => {
				const ja = entry.ja.trim();
				const missingWord = ja.length > 0 && trimmedWord.length > 0 && !ja.includes(trimmedWord);
				const open = editingId === entry.id;
				const regenning = regeneratingId === entry.id;
				return (
					<div key={entry.id} className={cn(i > 0 && "border-t border-soft-hairline")}>
						{/* Summary row: expand toggle + Remove sit as siblings (no nested
                interactive elements). */}
						<div className="flex items-center gap-2 py-2.5">
							<button
								type="button"
								onClick={() => setEditingId(open ? null : entry.id)}
								aria-expanded={open}
								className={cn(
									"flex min-w-0 flex-1 items-center gap-2 rounded-xs text-left",
									"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
								)}
							>
								<span
									aria-hidden="true"
									className={cn("font-mono text-faded-sumi leading-none transition-transform duration-150", open && "rotate-90")}
								>
									›
								</span>
								<span className="shrink-0 text-sm text-faded-sumi">{i + 1}</span>
								<span
									lang="ja"
									className={cn("min-w-0 truncate text-base", ja.length > 0 ? "text-sumi-ink" : "italic text-faded-sumi")}
								>
									{ja.length > 0 ? entry.ja : "Empty sentence"}
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
										This sentence doesn’t include
										{" "}
										{trimmedWord}
										. That’s fine if it’s a conjugated form.
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
											{regenning ? "Regenerating…" : "Regenerate this sentence"}
										</QuietLink>
									</div>
								)}
							</div>
						)}
					</div>
				);
			})}

			{pendingCount > 0 && <SentenceSkeletons count={pendingCount} />}

			<div>
				{atCap
					? (
							<p className="pt-3 text-sm text-faded-sumi">
								Up to
								{MAX_SENTENCES}
								{" "}
								sentences.
							</p>
						)
					: (
							<div className="pt-3">
								<QuietLink onClick={add} tone="brand" size="sm" ariaLabel="Add example sentence">+ Add sentence</QuietLink>
							</div>
						)}
			</div>
		</div>
	);
}

// Skeleton placeholder rows shown while a batch of sentences generates, so the
// number of inbound sentences is visible. Opacity pulse only (no layout
// animation); the global stylesheet disables it under prefers-reduced-motion.
function SentenceSkeletons({ count }: { count: number }): React.JSX.Element {
	return (
		<div className="flex flex-col" aria-hidden="true">
			{Array.from({ length: count }).map((_, i) => (
				// eslint-disable-next-line react/no-array-index-key -- fixed-count skeleton placeholders; no data to key by, order is stable.
				<div key={i} className="flex items-center gap-2 border-t border-soft-hairline py-2.5">
					<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faded-sumi/25" />
					<span className="h-3 w-1/2 rounded bg-cream-inset/70 animate-pulse" />
				</div>
			))}
		</div>
	);
}

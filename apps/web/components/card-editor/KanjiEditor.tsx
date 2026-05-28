"use client";

// Kanji-breakdown editor shared by the add-review and edit-card flows. The `add()` // initializer always sets `radical: ""` (a no-op for the add flow, which ignores // the field, and the round-trip value for the edit flow, which preserves it on save).

import type { KanjiEntry } from "./types";
import { Input } from "@/components/ui/Input";

import { QuietLink } from "@/components/ui/QuietLink";
import { nextRowKey } from "./types";

// ── Kanji breakdown editor ────────────────────────────────────────────────────

interface KanjiEditorProps {
	entries: KanjiEntry[];
	onChange: (next: KanjiEntry[]) => void;
}

export function KanjiEditor({ entries, onChange }: KanjiEditorProps): React.JSX.Element {
	const update = (i: number, patch: Partial<KanjiEntry>): void => {
		const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
		onChange(next);
	};
	const remove = (i: number): void => onChange(entries.filter((_, idx) => idx !== i));
	const add = (): void => onChange([...entries, { id: nextRowKey(), kanji: "", radical: "", meaning: "", reading: "" }]);

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
						onChange={e => update(i, { kanji: e.target.value })}
						script="kanji"
						placeholder="木"
					/>
					<Input
						label="Meaning"
						value={entry.meaning}
						onChange={e => update(i, { meaning: e.target.value })}
						placeholder="tree"
					/>
					<Input
						label="Reading"
						value={entry.reading}
						onChange={e => update(i, { reading: e.target.value })}
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
	);
}

import { Logo } from "@/components/ui/Logo";

interface TeacherNoteProps {
	/**
	 * Kanji ornament on the eyebrow row. Pair with `label` to opt into the
	 *  "kanji + small-caps label + hairline" header (e.g. on the Today page).
	 *  Omit both to render a headerless note (e.g. inside a SectionCard that
	 *  already provides its own eyebrow).
	 */
	kanji?: string;
	/** Small-caps mono label beside the kanji. See `kanji` above. */
	label?: string;
	/**
	 * The note body. Rendered inside an italic <blockquote> framed by the
	 *  vermillion 「」 corner brackets. Typed as `string` so the orphan-guard
	 *  can split on the last space and glue the closing bracket to the
	 *  final word via `whitespace-nowrap`.
	 */
	children: string;
}

// Tomo-voice editorial note. A faded logo watermark sits behind the prose,
// and the prose itself is framed as a quotation via hanging 「」 brackets in
// vermillion against italic sumi-ink body text. The "kanji + small-caps
// label + hairline" eyebrow is optional — pass `kanji` + `label` to enable
// it (e.g. the Today page's "言 / For today" header), or omit them when the
// surrounding chrome (e.g. a SectionCard header) already carries the label.
// Originally inlined in today-hero.tsx (NoteWatermarkFrame +
// FallbackPreparationRow / TomoNoteRow); extracted so other surfaces (the
// review summary's Session details card) can share the same voice without
// re-implementing the chrome.
export function TeacherNote({
	kanji,
	label,
	children,
}: TeacherNoteProps): React.JSX.Element {
	const showHeader = kanji !== undefined && label !== undefined;

	// Orphan-guard: split the body at its last space so the closing bracket
	// can stay glued to the final word via `whitespace-nowrap`. Without
	// this, the styled bracket span (inline-block, 1.25em) creates a wrap
	// opportunity at the end of the prose — when the previous line fits
	// the words but not the bracket, the bracket lands alone on its own
	// line, reading as a typesetting orphan.
	const lastSpace = children.lastIndexOf(" ");
	const head = lastSpace === -1 ? "" : children.slice(0, lastSpace + 1);
	const tail = lastSpace === -1 ? children : children.slice(lastSpace + 1);

	return (
		<div className="relative mt-6 mb-6 max-w-measure">
			<Logo
				size={140}
				showWordmark={false}
				className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 select-none opacity-[0.08]"
			/>

			{showHeader && (
				<div className="relative z-10 mb-3 flex items-center gap-2">
					<span
						aria-hidden="true"
						lang="ja"
						className="font-display text-lg leading-none text-inari-vermillion/85"
					>
						{kanji}
					</span>
					<span className="font-mono text-sm text-faded-sumi">
						{label}
					</span>
					<span aria-hidden="true" className="h-px flex-1 bg-soft-hairline" />
				</div>
			)}

			<blockquote
				cite="Tomo"
				className="relative z-10 break-words italic text-base leading-[1.55] text-sumi-ink sm:text-md"
			>
				<span
					aria-hidden="true"
					lang="ja"
					className="mr-0.5 inline-block text-[1.25em] leading-none select-none not-italic text-inari-vermillion/85"
				>
					「
				</span>
				{head}
				<span className="whitespace-nowrap">
					{tail}
					<span
						aria-hidden="true"
						lang="ja"
						className="ml-0.5 inline-block text-[1.25em] leading-none select-none not-italic text-inari-vermillion/85"
					>
						」
					</span>
				</span>
			</blockquote>
		</div>
	);
}

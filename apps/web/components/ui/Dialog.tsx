"use client";

import { useEffect, useId, useRef } from "react";

type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

interface DialogProps {
	open: boolean;
	onClose: () => void;
	/**
	 * Heading text. Optional: omit it together with an `eyebrow` and the
	 * eyebrow is promoted to title scale and serves as the dialog heading
	 * (used by the Memory popup). When present, renders as the h2 with the
	 * eyebrow above it at small scale.
	 */
	title?: string;
	/**
	 * Optional brand eyebrow rendered above the title. Mirrors the
	 * `PageHeader` rhythm (kanji + small-caps label) so the modal reads as
	 * part of the Tomo register, not a generic system popup.
	 *
	 * Pass `null` (or omit) to keep the title-only header.
	 */
	eyebrow?: { kanji: string; label: string } | null;
	/**
	 * Accessible name fallback. Only used when neither `title` nor `eyebrow`
	 * is provided; otherwise the rendered heading names the dialog via
	 * `aria-labelledby`. Provide this for headingless dialogs.
	 */
	ariaLabel?: string;
	/** Maximum width tier. Defaults to `md` (28rem) for legacy callers. */
	size?: DialogSize;
	children: React.ReactNode;
}

const SIZE_CLASS: Record<DialogSize, string> = {
	"sm": "max-w-sm", // 24rem
	"md": "max-w-md", // 28rem
	"lg": "max-w-lg", // 32rem
	"xl": "max-w-xl", // 36rem
	"2xl": "max-w-2xl", // 42rem
	"3xl": "max-w-3xl", // 48rem
	"4xl": "max-w-4xl", // 56rem
	"5xl": "max-w-5xl", // 64rem
};

/**
 * Brand-aligned modal dialog.
 *
 * Chrome mirrors `SectionCard`: 2px corners, 1px soft-hairline border, 2px
 * Inari Vermillion top stripe. Warm paper raised surface; soft sumi-ink
 * backdrop with a 2px blur for stage separation. Uses the native `<dialog>`
 * element for modal focus trap and top-layer rendering.
 */
export function Dialog({
	open,
	onClose,
	title,
	eyebrow,
	ariaLabel,
	size = "md",
	children,
}: DialogProps): React.JSX.Element {
	const ref = useRef<HTMLDialogElement>(null);
	const headingId = useId();

	// The dialog is named by its rendered heading (title, or eyebrow-as-title)
	// via aria-labelledby; only headingless dialogs fall back to aria-label.
	const hasTitle = title !== undefined && title !== "";
	const hasEyebrow = eyebrow !== undefined && eyebrow !== null;
	const hasHeading = hasTitle || hasEyebrow;

	useEffect(() => {
		const el = ref.current;
		if (!el)
			return;
		if (open && !el.open)
			el.showModal();
		if (!open && el.open)
			el.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			onClose={onClose}
			onClick={(e) => {
				if (e.target === e.currentTarget)
					onClose();
			}}
			{...(hasHeading ? { "aria-labelledby": headingId } : ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
			className={[
				// Modal box: 2px corners + hairline border + warm paper raised.
				// max-h caps the box to the viewport (dvh tracks mobile browser chrome)
				// and the open:flex column lets the body scroll within it, so tall
				// content on short viewports (portrait phones, any landscape phone)
				// stays reachable instead of being clipped by overflow-hidden. Content
				// that fits leaves the box at its natural height — desktop is unchanged.
				// The flex is gated to `open:` so a closed <dialog> keeps the UA
				// `display:none` (an unconditional `flex` would make it render while
				// closed). showModal() sets the [open] attribute the variant targets.
				"relative m-auto max-h-[calc(100dvh-2rem)] w-full overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised p-0 shadow-lg open:flex open:flex-col",
				SIZE_CLASS[size],
				// Backdrop: sumi-ink at 40% + a 2px blur to deepen the modal stage.
				"[&::backdrop]:bg-sumi-ink/40 [&::backdrop]:backdrop-blur-[2px]",
			].join(" ")}
		>
			{/* Brand identity stripe — the same 2px Vermillion bar that crowns
          every SectionCard surface across the app. */}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-inari-vermillion"
			/>

			{/* Pinned header: the title (context) and the close escape-hatch stay
          visible while a tall body scrolls beneath them on small viewports.
          pb-5 here reproduces the former mb-5 gap to the body. */}
			<div className="shrink-0 px-6 pt-7 pb-5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						{hasEyebrow && hasTitle && (
							<p className="mb-1.5 flex items-baseline gap-2 font-mono text-sm text-faded-sumi">
								<span
									lang="ja"
									aria-hidden="true"
									className="font-display text-sm leading-none translate-y-[0.05em] text-inari-vermillion"
								>
									{eyebrow?.kanji}
								</span>
								<span>{eyebrow?.label}</span>
							</p>
						)}
						{hasTitle ? (
							<h2 id={headingId} className="text-lg font-medium leading-tight text-sumi-ink">{title}</h2>
						) : hasEyebrow ? (
						// Title-less mode: the eyebrow IS the heading, at title scale.
							<h2 id={headingId} className="flex items-baseline gap-3">
								<span
									lang="ja"
									aria-hidden="true"
									className="font-display text-2xl leading-none translate-y-[0.05em] text-inari-vermillion"
								>
									{eyebrow?.kanji}
								</span>
								<span className="font-mono text-lg font-medium uppercase tracking-[0.12em] text-sumi-ink">
									{eyebrow?.label}
								</span>
							</h2>
						) : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						// 44px touch target on phones, tightening to the 28px pointer size
						// on sm+. Negative margins absorb the larger box so the header
						// geometry is unchanged at every size (matches card-detail-view).
						className="ui-motion-colors -my-2.5 -mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xs text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 sm:my-0 sm:-mr-1 sm:h-7 sm:w-7"
					>
						<svg
							aria-hidden="true"
							width="12"
							height="12"
							viewBox="0 0 12 12"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M2 2l8 8M10 2l-8 8" />
						</svg>
					</button>
				</div>
			</div>

			{/* Body scrolls within the viewport-capped box (max-h lives on the
          dialog). Header above stays pinned. */}
			<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
				{children}
			</div>
		</dialog>
	);
}

"use client";

import { TomoSelect } from "@/components/ui/TomoSelect";
import { ToolbarChip } from "@/components/ui/ToolbarChip";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type CardsPageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface Props {
	pageIndex: number; // 0-indexed
	pageSize: CardsPageSize;
	totalCount: number;
	/** Caller takes a 1-indexed page number. */
	onPickPage: (nextPage: number) => void;
	onPrev: () => void;
	onNext: () => void;
	onPageSizeChange: (next: CardsPageSize) => void;
	/**
	 * True while a refetch is in flight. Disables navigation buttons and
	 * swaps the Next arrow for a small spinning ring so the user has an
	 * explicit "busy" signal at the click point.
	 */
	isPaginating?: boolean;
}

/**
 * Pagination footer for the Cards browser. Layout:
 *
 *   [Per page 25 ▾]  ‹ Prev  1 … 4 5 [6] 7 8 … 12  Next ›   Showing 51–75 of 296
 *
 * Page numbers are clickable for random-page jump. The window is
 * "first + last + current ± 2 + neighbours of edges," collapsed with
 * `…` sentinels. Active page uses ToolbarChip's `selected` state so
 * it reads as the same affordance as a selected dimension filter.
 */
export function CardsPagination({
	pageIndex,
	pageSize,
	totalCount,
	onPickPage,
	onPrev,
	onNext,
	onPageSizeChange,
	isPaginating = false,
}: Props): React.JSX.Element | null {
	if (totalCount <= 0)
		return null;

	const currentPage = pageIndex + 1;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	const start = pageIndex * pageSize + 1;
	const end = Math.min((pageIndex + 1) * pageSize, totalCount);
	const hasPrev = currentPage > 1;
	const hasNext = currentPage < totalPages;

	const visiblePages = buildVisiblePages(currentPage, totalPages);

	return (
		<nav
			aria-label="Cards pagination"
			className="mt-5 flex flex-col items-stretch gap-3 border-t border-soft-hairline pt-4 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
		>
			{/* ── Per-page selector ──────────────────────────────────────────
          Order is reversed on mobile: pagination nav (the dominant
          action) comes first; per-page metadata follows. On desktop
          the visual order is per-page → nav → showing-text, which the
          `sm:order-*` rules restore. */}
			<div className="order-2 flex items-center gap-2 sm:order-1">
				<span className="hidden font-mono text-sm text-faded-sumi sm:inline">
					Per page
				</span>
				<TomoSelect
					value={String(pageSize)}
					onValueChange={v => onPageSizeChange(Number(v) as CardsPageSize)}
					options={PAGE_SIZE_OPTIONS.map(n => ({ value: String(n), label: String(n) }))}
					ariaLabel="Cards per page"
					// Touch target on mobile: the per-page selector lands at
					// 44px via min-h, the same `min-h-11 sm:min-h-0`
					// pattern used on the View dropdown. min-h doesn't fight
					// TomoSelect's intrinsic height on desktop because the
					// trigger is shorter than 44px there.
					className="min-w-[4.5rem] min-h-11 sm:min-h-0"
				/>
			</div>

			{/* ── Middle cluster: Prev / numbered pages / Next ────────────────
          Mobile: numbered chips scroll horizontally with a right-edge
          fade mask so off-screen pages are discoverable without
          letting them push Prev/Next off the screen. Desktop:
          natural flex layout, no scroll. */}
			<div className="order-1 flex items-stretch gap-1 sm:order-2 sm:items-center">
				<ToolbarChip
					size="sm"
					disabled={!hasPrev || isPaginating}
					onClick={onPrev}
					leadingNode={<ArrowLeftGlyph />}
					aria-label="Previous page"
					className="shrink-0 min-h-11 sm:min-h-0"
				>
					<span className="hidden sm:inline">Prev</span>
				</ToolbarChip>

				{/* Horizontally scrollable rail on mobile. The negative
            margins + mask-image fade are the same pattern as the
            mobile filter-chip rail above the table. On sm+ the rail
            collapses back to a normal flex row (no scroll, no mask). */}
				<div
					className={[
						"flex flex-1 items-center gap-1 overflow-x-auto sm:flex-none sm:overflow-visible",
						"[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-1.5rem),transparent_100%)]",
						"sm:[mask-image:none]",
					].join(" ")}
				>
					{visiblePages.map((token, idx) =>
						token === "…"
							? (
									<span
										// eslint-disable-next-line react/no-array-index-key -- two identical ellipsis gap tokens distinguished only by position; index is the disambiguator.
										key={`gap-${idx}`}
										aria-hidden="true"
										className="shrink-0 px-1.5 font-mono text-xs text-faded-sumi/60"
									>
										…
									</span>
								)
							: (
									<ToolbarChip
										key={token}
										size="sm"
										state={token === currentPage ? "selected" : "default"}
										disabled={isPaginating}
										onClick={() => onPickPage(token)}
										aria-label={`Page ${token}`}
										aria-current={token === currentPage ? "page" : undefined}
										className="shrink-0 min-w-[2.25rem] justify-center tabular-nums min-h-11 sm:min-h-0 sm:min-w-[2rem]"
									>
										{token}
									</ToolbarChip>
								),
					)}
				</div>

				<ToolbarChip
					size="sm"
					disabled={!hasNext || isPaginating}
					onClick={onNext}
					trailingNode={isPaginating ? <PagingSpinner /> : <ArrowRightGlyph />}
					aria-label={isPaginating ? "Loading next page" : "Next page"}
					className="shrink-0 min-h-11 sm:min-h-0"
				>
					<span className="hidden sm:inline">Next</span>
				</ToolbarChip>
			</div>

			{/* ── Desktop-only "Showing X–Y of N" ───────────────────────────
          Hidden on mobile (sm:inline-block on the wrapper). The
          mobile equivalent — a compact "X–Y of N" — sits next to the
          per-page selector above to keep the slice visible at a
          glance without consuming an extra row. */}
			<p className="order-3 hidden font-mono text-xs text-faded-sumi tabular-nums sm:inline-block">
				Showing
				{" "}
				<span className="text-sumi-ink">{start}</span>
				{start !== end && (
					<>
						–
						<span className="text-sumi-ink">{end}</span>
					</>
				)}
				{" of "}
				<span className="text-sumi-ink">{totalCount}</span>
			</p>
		</nav>
	);
}

// ─── Page-window calculation ───────────────────────────────────────────

/**
 * Build the visible page list with ellipses for gaps. Window is
 * "current ± 2", and we always include 1 and totalPages at the edges.
 * Returns a mixed array of numbers (page tokens) and the literal '…'
 * for non-interactive gap separators.
 *
 * Example outputs:
 *   total=12, current=1   → [1, 2, 3, '…', 12]
 *   total=12, current=6   → [1, '…', 4, 5, 6, 7, 8, '…', 12]
 *   total=12, current=11  → [1, '…', 9, 10, 11, 12]
 *   total=3,  current=2   → [1, 2, 3]   (no ellipses needed)
 *   total=1,  current=1   → [1]
 */
function buildVisiblePages(current: number, total: number): ReadonlyArray<number | "…"> {
	if (total <= 1)
		return [1];

	const window = 2;
	const pages = new Set<number>([1, total]);
	for (let p = current - window; p <= current + window; p += 1) {
		if (p >= 1 && p <= total)
			pages.add(p);
	}

	const sorted = [...pages].sort((a, b) => a - b);
	const out: (number | "…")[] = [];
	for (let i = 0; i < sorted.length; i += 1) {
		const page = sorted[i];
		if (page === undefined)
			continue;
		if (i > 0) {
			const prev = sorted[i - 1];
			if (prev !== undefined && page - prev > 1) {
				out.push("…");
			}
		}
		out.push(page);
	}
	return out;
}

// ─── Inline glyphs ─────────────────────────────────────────────────────

function ArrowLeftGlyph(): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M7 2L3 5l4 3" />
		</svg>
	);
}

function ArrowRightGlyph(): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 2l4 3-4 3" />
		</svg>
	);
}

/**
 * Small inline spinning ring shown in the Next chip's trailing slot
 * while a refetch is in flight. 10×10 keeps it visually weighted like
 * the `→` glyph it replaces; current-color so it inherits the chip's
 * disabled tint.
 */
function PagingSpinner(): React.JSX.Element {
	return (
		<svg
			width="10"
			height="10"
			viewBox="0 0 10 10"
			aria-hidden="true"
			className="cards-pagination-spin"
		>
			<circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
			<path d="M5 1 A4 4 0 0 1 9 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

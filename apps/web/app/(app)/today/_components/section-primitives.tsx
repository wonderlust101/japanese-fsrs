"use client";

// Reusable visuals for Today modules: card chrome, empty/error states, and
// notices. The decorative preview art (empty/error illustrations + tone
// tokens) lives in ./section-state-previews and is imported below.
//
// File map: CardHeader → module chrome consts → EmptyState / UnavailableState →
// NoticeFrame → ConnectionErrorNotice → ModuleState.

import type { EmptyStateVisual, ErrorStateVisual } from "./section-state-previews";
import { KanjiLabel } from "@/components/ui/KanjiLabel";
import { StatusPill } from "@/components/ui/Pill";

import { QuietLink } from "@/components/ui/QuietLink";
import { EmptyStatePreview, ErrorSignalPreview } from "./section-state-previews";
import { formatExactCount } from "./today-format";

// SkeletonBlock re-export retired with the rest of the per-component
// skeletons; loading is handled at the route level by <PageLoader/>.

// ── CardHeader (kanji ornament + small-caps mono + right action + rule) ──────

interface CardHeaderProps {
	/**
	 * DOM id rendered on the inner <h2>. Pair with `aria-labelledby` on the
	 * <section> wrapper so screen readers announce the section by its kanji
	 * label. Required for any carded section that uses aria-labelledby.
	 */
	id?: string;
	/** Single kanji or 2-char compound. Rendered at text-xl in all cases. */
	kanji: string;
	/** Small-caps mono label rendered after the kanji. */
	label: string;
	/** Optional count rendered after the label as " · {n}". */
	count?: number;
	/** Optional context line rendered below the label in richer module headers. */
	description?: string;
	/** Optional right-aligned content. Interactive children own their target size. */
	rightContent?: React.ReactNode;
	/**
	 * Archetype rhythm. Keeps the kanji header vocabulary intact while letting
	 * chart/list/progress modules avoid identical spacing. Kanji size is now
	 * fixed at text-xl regardless of variant; this prop only affects margins.
	 */
	variant?: "default" | "compact" | "chart";
	/**
	 * Kanji ornament color. Defaults to `'brand'` (Inari Vermillion) — the
	 * canonical Tomo module accent. Use `'aizome'` (indigo) for surfaces that
	 * carry a non-brand stripe tone so the kanji reads as deliberate, not as
	 * an oversight against the stripe color.
	 */
	kanjiTone?: "brand" | "aizome" | "error";
	/**
	 * Quiet metadata flag rendered inline after the label, separated by a
	 * faded middot. Mirrors today-hero's HeroKicker `flag` idiom — used for
	 * trust signals about the module's payload (e.g. "Showing the last saved
	 * queue" when data is stale). Stays in the same typographic register as
	 * the label, just tinted aizome.
	 */
	flag?: string;
}

export function CardHeader({
	id,
	kanji,
	label,
	count,
	description,
	rightContent,
	variant = "default",
	kanjiTone = "brand",
	flag,
}: CardHeaderProps): React.JSX.Element {
	const hasDescription = description !== undefined;
	const headerMargin = hasDescription
		? "mb-5"
		: variant === "chart"
			? "mb-3"
			: variant === "compact"
				? "mb-4"
				: "mb-5";
	const title = (
		<h2 id={id} className="flex min-w-0 flex-wrap items-baseline gap-3">
			<KanjiLabel
				kanji={kanji}
				tone={kanjiTone}
				label={(
					<>
						{label}
						{count !== undefined && (
							<span className="ml-1.5 text-faded-sumi">
								·
								{formatExactCount(count)}
							</span>
						)}
					</>
				)}
			/>
			{flag !== undefined && flag.trim().length > 0 && (
				<>
					<span aria-hidden="true" className="font-mono text-sm leading-none text-faded-sumi/70">·</span>
					<span className="font-mono text-sm uppercase tracking-normal text-aizome-indigo/85">
						{flag.trim()}
					</span>
				</>
			)}
		</h2>
	);

	return (
		<header className={headerMargin}>
			{hasDescription ? (
				<div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:content-center">
					<div className="min-w-0">
						{title}
						<p className="mt-2 max-w-measure break-words text-sm leading-[1.55] text-faded-sumi">
							{description}
						</p>
					</div>
					{rightContent !== undefined && (
						<div className="min-w-0 shrink-0 -my-2 py-2 font-mono text-xs text-faded-sumi tracking-wide sm:justify-self-end">
							{rightContent}
						</div>
					)}
				</div>
			) : (
			// Stacks below sm so a wide rightContent (e.g. "See the next two
			// weeks →") doesn't pinch the title on phones; flips to a single
			// baseline-aligned row at sm+. Mirrors the with-description grid's
			// responsive shape so both CardHeader paths feel identical at the
			// viewport boundary.
				<div className="flex min-w-0 flex-col gap-y-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4 sm:gap-y-0">
					{title}
					{rightContent !== undefined && (
					// The slot preserves header rhythm; interactive children own their
					// actual target size.
						<div className="min-w-0 shrink-0 -my-2 py-2 font-mono text-xs text-faded-sumi tracking-wide">
							{rightContent}
						</div>
					)}
				</div>
			)}
			<hr
				aria-hidden="true"
				className={[
					"border-0 border-t border-soft-hairline",
					variant === "chart" ? "mt-2.5" : "mt-3",
				].join(" ")}
			/>
		</header>
	);
}

export const CHART_MODULE_CHROME = [
	"relative overflow-hidden bg-warm-paper-raised",
	"border border-soft-hairline rounded-xs",
	"px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7",
].join(" ");

export const LIST_MODULE_CHROME = [
	"h-full bg-warm-paper-raised",
	"border border-soft-hairline rounded-xs",
	"px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7",
].join(" ");

// ── Empty and notice atoms ───────────────────────────────────────────────────

interface EmptyStateAction {
	href: string;
	label: string;
	ariaLabel?: string;
}

interface EmptyStateProps {
	title: string;
	body: string;
	action?: EmptyStateAction;
	visual?: EmptyStateVisual;
	preview?: React.ReactNode | null;
	previewAriaLabel?: string;
	className?: string;
	contentClassName?: string;
}

export function EmptyState({
	title,
	body,
	action,
	visual,
	preview,
	previewAriaLabel,
	className = "",
	contentClassName = "",
}: EmptyStateProps): React.JSX.Element {
	const resolvedPreview = preview !== undefined
		? preview
		: (
				visual !== undefined ? <EmptyStatePreview visual={visual} /> : undefined
			);
	const previewA11yProps = previewAriaLabel === undefined
		? { "aria-hidden": true }
		: { "aria-label": previewAriaLabel };

	return (
		<div className={`min-w-0 py-6 ${className}`}>
			<div className="grid w-full min-w-0 gap-6">
				<div className={`min-w-0 w-full ${contentClassName}`}>
					<p className="break-words font-display text-lg leading-tight text-sumi-ink">
						{title}
					</p>
					<p className="mt-2 max-w-measure break-words text-sm leading-relaxed text-faded-sumi">
						{body}
					</p>
					{action !== undefined && (
						<div className="mt-4">
							<QuietLink
								href={action.href}
								tone="brand"
								trailingArrow
								{...(action.ariaLabel !== undefined ? { ariaLabel: action.ariaLabel } : {})}
							>
								{action.label}
							</QuietLink>
						</div>
					)}
				</div>

				{resolvedPreview !== undefined && resolvedPreview !== null && (
					<div className="min-w-0 w-full" {...previewA11yProps}>
						{resolvedPreview}
					</div>
				)}
			</div>
		</div>
	);
}

export function UnavailableState({
	title,
	body,
	action,
	preview,
	previewAriaLabel,
	className = "",
	contentClassName = "",
}: EmptyStateProps): React.JSX.Element {
	const resolvedPreview = preview === undefined ? null : preview;

	return (
		<EmptyState
			title={title}
			body={body}
			className={className}
			contentClassName={contentClassName}
			{...(action !== undefined ? { action } : {})}
			preview={resolvedPreview}
			{...(previewAriaLabel !== undefined ? { previewAriaLabel } : {})}
		/>
	);
}

interface NoticeFrameProps {
	title?: string | undefined;
	message?: string | undefined;
	body?: string | undefined;
	retryHref?: string | undefined;
	refreshLabel?: string | undefined;
	staleFallback?: string | undefined;
	visual?: ErrorStateVisual | null | undefined;
	className?: string | undefined;
}

interface NoticeContent {
	label: string;
	title: string;
	body: string;
}

const CONNECTION_NOTICE: NoticeContent = {
	label: "Connection",
	title: "Connection issue",
	body: "This section did not load. Check your connection, then refresh.",
};

function NoticeFrame({
	content,
	title,
	message,
	body,
	retryHref = "?retry=now",
	refreshLabel = "Refresh",
	staleFallback,
	visual = null,
	className = "",
}: NoticeFrameProps & { content: NoticeContent }): React.JSX.Element {
	const hasVisual = visual !== null && visual !== undefined;

	return (
		<div
			role="alert"
			className={[
				"w-full min-w-0 rounded-xs border border-error/25 bg-error-tint/35 p-4 sm:p-5",
				className,
			].join(" ")}
		>
			<div
				className={[
					"grid gap-4 sm:items-center",
					hasVisual ? "sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.72fr)]" : "",
				].join(" ")}
			>
				<div className="min-w-0">
					<StatusPill status="danger" label={content.label} size="sm" />

					<p className="mt-3 break-words text-sm font-semibold leading-relaxed text-error-deep">
						{title ?? content.title}
					</p>
					<p className="mt-1.5 max-w-measure break-words text-sm leading-relaxed text-sumi-ink/80">
						{message ?? body ?? content.body}
					</p>
					{staleFallback !== undefined && (
						<p className="mt-2 break-words font-mono text-xs leading-relaxed tracking-wide text-error-deep/80">
							{staleFallback}
						</p>
					)}
					<div className="mt-4">
						<QuietLink href={retryHref} tone="error" trailingArrow>
							{refreshLabel}
						</QuietLink>
					</div>
				</div>

				{visual !== null && visual !== undefined && <ErrorSignalPreview visual={visual} />}
			</div>
		</div>
	);
}

export interface ConnectionErrorNoticeProps extends NoticeFrameProps {
	sectionName?: string;
}

export function ConnectionErrorNotice({
	sectionName,
	message,
	title,
	...props
}: ConnectionErrorNoticeProps): React.JSX.Element {
	const sectionMessage = sectionName !== undefined
		? `${sectionName} did not load. Check your connection, then refresh.`
		: undefined;

	return (
		<NoticeFrame
			{...props}
			content={CONNECTION_NOTICE}
			title={title}
			message={message ?? sectionMessage}
		/>
	);
}

// ── Module state type ────────────────────────────────────────────────────────

export type ModuleState = "default" | "loading" | "error" | "unavailable";

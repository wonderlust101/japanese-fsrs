"use client";

import Link from "next/link";

import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { Logo } from "@/components/ui/Logo";

/**
 * Shared composition for surfaces that signal "no content lives here" (not-
 * found) or "something interrupted practice" (error). Both surfaces share the
 * same card-on-cool-paper anatomy from DESIGN.md (the card-stack identity):
 * 2px Inari Vermillion top stripe, 1px Soft Hairline border, Warm Paper Raised
 * fill, no resting shadow. The kitsune lives in the identity strip at the top;
 * the card-stack hero sits below the kicker. Composition reads as a single
 * deck card the user is looking at, not a "page that broke."
 *
 * Five composable pieces, used by the five entry points
 * (app/not-found.tsx, app/error.tsx, app/global-error.tsx and the
 * (app)-segment variants). Each piece mirrors a part of the dashboard hero
 * (`HeroKicker`, `HeroPrimaryAction`) so the visual language stays continuous
 * across surfaces.
 */

export type StateTone = "default" | "error";

interface PageStateFrameProps {
	/**
	 * `fullbleed` paints the cool-paper page background and centers the card.
	 * Used by root-level surfaces that may render without an app shell (404 on
	 * an unauthenticated route, the root error boundary, the global last-resort
	 * boundary).
	 *
	 * `inshell` skips the page-level background because the (app) layout
	 * already paints `bg-cool-paper-base`. The composition sits inside the
	 * scrollable main area so the sidebar and top-bar remain.
	 */
	variant: "fullbleed" | "inshell";
	children: React.ReactNode;
}

/**
 * Outer frame. Owns the page-level background (when full-bleed) and the
 * vertical centering. Inner card composition is identical between variants.
 */
export function PageStateFrame({ variant, children }: PageStateFrameProps): React.JSX.Element {
	const card = (
		<section
			role="region"
			aria-labelledby="page-state-headline"
			className={[
				"relative w-full max-w-[min(640px,92vw)] overflow-hidden rounded-xs",
				"border border-soft-hairline bg-warm-paper-raised",
				"px-6 py-8 sm:px-10 sm:py-12",
			].join(" ")}
		>
			<span
				aria-hidden="true"
				className="absolute inset-x-0 top-0 z-10 h-0.5 bg-inari-vermillion"
			/>
			<div className="relative z-0 flex flex-col items-center text-center">
				{children}
			</div>
		</section>
	);

	if (variant === "inshell") {
		return (
			<div className="flex min-h-full w-full items-start justify-center px-4 py-12 sm:py-20">
				{card}
			</div>
		);
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-cool-paper-base px-4 py-12 sm:py-16">
			{card}
		</main>
	);
}

/**
 * Identity strip at the very top of the card. The Logo component already
 * draws the kitsune mark + TOMO wordmark; the underline strip beneath the
 * wordmark mirrors the sidebar header construction so the surface is
 * recognizably Tomo before the visitor reads anything.
 *
 * The kitsune SVG is the canonical brand mark and stays Inari Vermillion
 * regardless of tone (PRODUCT.md: never recolored for decoration). The
 * underline IS recolorable — error tone swaps it to the error red so the
 * brand still announces itself but the surface reads as an error moment
 * before the eye reaches the kicker.
 */
export function IdentityStrip({ tone = "default" }: { tone?: StateTone }): React.JSX.Element {
	const isError = tone === "error";

	return (
		<div className="relative inline-flex items-center" aria-label="Tomo">
			<Logo size={56} wordmarkSize="lg" priority />
			<span
				aria-hidden="true"
				className={[
					"absolute h-px",
					isError ? "bg-error" : "bg-inari-vermillion",
				].join(" ")}
				style={{ left: "3.75rem", right: 0, bottom: "0.55rem" }}
			/>
		</div>
	);
}

/**
 * Kanji + uppercase mono label, separated from the visual below by a 1px
 * hairline. Mirrors the dashboard hero's `HeroKicker` exactly so the page
 * reads as Tomo's typographic register, not a generic error page.
 */
export function HeroKicker({
	kanji,
	label,
	tone = "default",
}: {
	kanji: string;
	label: string;
	tone?: StateTone;
}): React.JSX.Element {
	const isError = tone === "error";

	return (
		<header className="mt-6 w-full">
			<p className="flex items-baseline justify-center gap-4">
				<span
					lang="ja"
					aria-hidden="true"
					className={[
						"select-none font-display text-3xl leading-none",
						isError ? "text-error" : "text-inari-vermillion",
					].join(" ")}
				>
					{kanji}
				</span>
				<span
					className={[
						"font-mono text-sm font-medium",
						isError ? "text-error-deep/85" : "text-sumi-ink/80",
					].join(" ")}
				>
					{label}
				</span>
			</p>
			<hr
				aria-hidden="true"
				className={[
					"mx-auto mt-4 w-full border-0 border-t",
					isError ? "border-error/25" : "border-soft-hairline",
				].join(" ")}
			/>
		</header>
	);
}

/**
 * Slot for the card-stack visual. Held to a fixed min-height so the page
 * doesn't reflow when the visual swaps. Honors reduced-motion via parent.
 */
export function VisualSlot({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<div
			aria-hidden="true"
			className="mt-8 flex w-full items-center justify-center"
		>
			{children}
		</div>
	);
}

/**
 * Single dust-jacket deck card sitting on the desk with the dashed-hairline
 * empty-state outline pattern from the dashboard hero's empty fallback.
 * Carries a kanji on its face at low opacity, so the card itself echoes
 * the typographic moment above it, plus a small mono label that names
 * the kind of moment.
 *
 * Shared by not-found surfaces (default tone: soft-hairline border, sumi
 * kanji, faded-sumi label) and error surfaces (error tone: dashed error
 * border, error-deep kanji at low opacity, error-deep label). Same calm
 * composition, two semantic color registers — the visual SHAPE says
 * "nothing to do here," the visual COLOR says whether that's a quiet
 * empty state or an interrupted one.
 */
export function EmptyPathVisual({
	kanji = "路",
	label = "Empty path",
	tone = "default",
}: {
	kanji?: string;
	label?: string;
	tone?: StateTone;
}): React.JSX.Element {
	const isError = tone === "error";

	return (
		<div className="relative h-[180px] w-full max-w-[280px]">
			<div
				className={[
					"absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-1.2deg]",
					"mx-auto w-[88%] rounded-xs px-5 py-6",
					"border border-dashed",
					isError
						? "border-error/45 bg-error-tint/25"
						: "border-soft-hairline bg-warm-paper-raised/70",
				].join(" ")}
			>
				<p
					lang="ja"
					aria-hidden="true"
					className={[
						"text-center font-display text-5xl leading-none",
						isError ? "text-error-deep/25" : "text-sumi-ink/15",
					].join(" ")}
				>
					{kanji}
				</p>
				<p
					className={[
						"mt-4 text-center font-mono text-sm",
						isError ? "text-error-deep" : "text-faded-sumi",
					].join(" ")}
				>
					{label}
				</p>
			</div>
		</div>
	);
}

/**
 * Page headline (h1). One per page. Bricolage Grotesque, scale tuned to
 * read as a calm statement rather than a shout. Error tone is retained as
 * an option for any future surface that wants the deeper red, though all
 * current page-state surfaces use the default (sumi-ink) register.
 */
export function PageHeadline({
	children,
	tone = "default",
}: {
	children: React.ReactNode;
	tone?: StateTone;
}): React.JSX.Element {
	return (
		<h1
			id="page-state-headline"
			className={[
				"mt-7 font-display text-title",
				tone === "error" ? "text-error-deep" : "text-sumi-ink",
			].join(" ")}
		>
			{children}
		</h1>
	);
}

/**
 * Body line under the headline. Holds the reassurance ("Nothing has been
 * lost.", "Nothing on the schedule has changed.") so the calm carries the
 * page even when the kicker is in error tone.
 */
export function PageBody({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<p className="mt-3 max-w-measure-tight text-base leading-relaxed text-faded-sumi">
			{children}
		</p>
	);
}

interface PrimaryActionProps {
	children: React.ReactNode;
	tone?: StateTone;
	href?: string;
	onClick?: () => void;
	type?: "button" | "submit";
}

/**
 * Primary CTA, matching the dashboard hero's `HeroPrimaryAction` exactly.
 * Vermillion fill by default; error tone swaps to the danger fill so the
 * action visually owns the failure surface. Accepts either an `href`
 * (renders Next/Link) or `onClick` (renders a button for the soft-retry
 * call to `reset()` on error.tsx).
 */
export function PrimaryAction({
	children,
	tone = "default",
	href,
	onClick,
	type = "button",
}: PrimaryActionProps): React.JSX.Element {
	const isError = tone === "error";
	// Color order matches DESIGN.md §Components → Buttons: brand red at rest,
	// deep variant on hover. Same direction (lighter → darker on interaction)
	// for both tones, so the button reads consistently regardless of register.
	const className = [
		"inline-flex min-h-12 min-w-[240px] max-w-full items-center justify-center gap-3",
		"rounded-xs px-8 py-3 text-base font-semibold",
		"today-motion-transform",
		"focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2",
		isError
			? "bg-error text-warm-paper-raised hover:bg-error-deep active:bg-error-deep active:shadow-pressed focus-visible:outline-error-deep"
			: "bg-inari-vermillion text-warm-paper-raised hover:bg-inari-vermillion-deep active:bg-inari-vermillion-deep active:shadow-pressed focus-visible:outline-sumi-ink",
	].join(" ");

	const inner = (
		<>
			{children}
			<ArrowGlyph direction="right" />
		</>
	);

	if (href !== undefined) {
		return (
			<div className="mt-8">
				<Link href={href} className={className}>
					{inner}
				</Link>
			</div>
		);
	}

	return (
		<div className="mt-8">
			<button type={type} onClick={onClick} className={className}>
				{inner}
			</button>
		</div>
	);
}

interface InlinePathsRowProps {
	children: React.ReactNode;
}

/**
 * Row of small ghost-style secondary paths. Wraps on narrow viewports.
 * Used for the 404's "Browse decks · Reviews · Settings" trio and the
 * 500's "Back to dashboard · Report this" pair.
 */
export function InlinePathsRow({ children }: InlinePathsRowProps): React.JSX.Element {
	return (
		<ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-faded-sumi">
			{children}
		</ul>
	);
}

interface InlinePathProps {
	children: React.ReactNode;
	href?: string;
	onClick?: () => void;
}

/**
 * Single secondary path. Renders as a Link when given an href; renders as
 * a button when given onClick (the Report-this case copies a payload to
 * the clipboard rather than navigating).
 *
 * The arrow glyph trails the label (right side) so the inline-paths row
 * stays consistent with the primary CTA and the FullReloadHint — every
 * navigable affordance on the page reads label-first, arrow-trailing.
 */
export function InlinePath({ children, href, onClick }: InlinePathProps): React.JSX.Element {
	const className = [
		"inline-flex items-center gap-2 rounded-xs px-1 py-1",
		"text-sm text-faded-sumi transition-colors",
		"hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink",
	].join(" ");

	const inner = (
		<>
			<span>{children}</span>
			<ArrowGlyph direction="right" className="opacity-60" />
		</>
	);

	return (
		<li>
			{href !== undefined
				? (
						<Link href={href} className={className}>{inner}</Link>
					)
				: (
						<button type="button" onClick={onClick} className={className}>{inner}</button>
					)}
		</li>
	);
}

/**
 * Quiet "Full reload →" link that the error page shows once the user has
 * tried `reset()` twice without success. Lives below the primary row so
 * it's discoverable but doesn't compete with the soft-retry default.
 */
export function FullReloadHint({ onClick }: { onClick: () => void }): React.JSX.Element {
	return (
		<p className="mt-3 text-sm text-faded-sumi">
			<button
				type="button"
				onClick={onClick}
				className="inline-flex items-center gap-2 rounded-xs px-1 py-1 text-faded-sumi underline-offset-4 transition-colors hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
			>
				Still stuck? Full reload
				<ArrowGlyph direction="right" className="opacity-60" />
			</button>
		</p>
	);
}

// The development error panel and the shared Markdown report builder live in
// ./page-state-dev-panel; re-exported here so error / not-found pages keep a
// single import site.
export { buildMarkdownReport, DevPanel } from "./page-state-dev-panel";

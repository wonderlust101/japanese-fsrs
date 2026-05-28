"use client";

// The four Today hero variants (Due / CaughtUp / FirstTime / Resume) plus the
// shared HeroLayout, HeroKicker, HeroPrimaryAction, CTA palette and queue
// normalizer. Consumed by DashboardHero in ./today-hero.

import type { DueQueue, HeroDeckPreview, ResumeContextSnapshot } from "./today-hero-types";

import Link from "next/link";
import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { CompositionStrip } from "@/components/review/CompositionStrip";
import { Logo } from "@/components/ui/Logo";

import { QuietLink } from "@/components/ui/QuietLink";
import { formatExactCount, safeNonNegativeInteger } from "./today-format";
import { DeckStack } from "./today-hero-deck-stack";
import { HeroPreSessionNote } from "./today-hero-pre-session-note";

// ── CTA classes ──────────────────────────────────────────────────────────────
// Hero CTAs render as <Link> (Next.js navigation), so the design-system
// <Button> primitive can't host them directly. To stay aligned, the palette
// here mirrors Button's `primary` / `secondary` variants exactly:
//   • primary  — bg-inari-vermillion, deepens on hover (per Buttons spec)
//   • secondary — warm-paper-raised, cream-inset on hover
// No translate or scale transforms: DESIGN.md "no scale transform. The press
// is felt as ink, not as movement." Color shift carries the press.

const HERO_CTA_BASE = [
	"inline-flex min-h-14 w-full max-w-full items-center justify-center gap-3 rounded-xs px-6 py-3",
	"sm:w-auto sm:min-w-[min(280px,100%)] sm:px-10",
	"text-base font-semibold",
	"today-motion-colors",
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink",
].join(" ");

const HERO_CTA_PRIMARY = [
	"bg-inari-vermillion text-warm-paper-raised",
	"hover:bg-inari-vermillion-deep",
	"active:bg-inari-vermillion-deep active:shadow-pressed",
].join(" ");

const HERO_CTA_SECONDARY = [
	"border border-soft-hairline bg-warm-paper-raised text-sumi-ink",
	"hover:border-faded-sumi hover:bg-cream-inset",
	"active:bg-soft-hairline",
].join(" ");

function heroCtaClass(variant: "primary" | "secondary"): string {
	return [HERO_CTA_BASE, variant === "primary" ? HERO_CTA_PRIMARY : HERO_CTA_SECONDARY].join(" ");
}

// ── Placeholder decks ────────────────────────────────────────────────────────

const RESTING_DECKS: HeroDeckPreview[] = [
	{
		id: "resting-review",
		title: "Review deck",
		subtitle: "Nothing is due right now",
		dueCount: 0,
		tag: { kind: "none" },
	},
	{
		id: "resting-schedule",
		title: "Next review",
		subtitle: "Cards return at the right time",
		dueCount: 0,
		tag: { kind: "none" },
	},
];

// ── Variant: Due ─────────────────────────────────────────────────────────────

export function DueContent({ queue, dateKey }: {
	queue: DueQueue;
	dateKey: string | undefined;
}): React.JSX.Element {
	const safeQueue = normalizeDueQueue(queue);
	const cardWord = safeQueue.total === 1 ? "card" : "cards";

	return (
		<HeroLayout
			visual={(
				<DeckStack
					decks={safeQueue.decks}
					overflowDecks={safeQueue.overflowDecks}
					emptyLabel="Queue details unavailable"
					emptyDescription="Reviews can still start from the total count."
				/>
			)}
		>
			<HeroKicker
				kanji="今"
				label="Today's plan"
				{...(safeQueue.statusNote !== undefined ? { flag: safeQueue.statusNote } : {})}
			/>

			<h2
				id="hero-headline"
				className="mt-6 break-words font-display text-hero text-sumi-ink"
			>
				{formatExactCount(safeQueue.total)}
				{" "}
				{cardWord}
				{" "}
				due
			</h2>

			<CompositionStrip
				breakdown={{
					newCount: safeQueue.newCnt,
					reviewCount: safeQueue.review,
					backlogCount: safeQueue.backlog,
				}}
				className="mt-6"
			/>

			<HeroPreSessionNote dateKey={dateKey} />

			<div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
				<Link
					href="/review/session"
					className={`hidden lg:inline-flex ${heroCtaClass("primary")}`}
				>
					Start reviews
					<ArrowGlyph direction="right" />
				</Link>

				<Link
					href="/review/setup"
					className={heroCtaClass("secondary")}
				>
					Customize this session
					<ArrowGlyph direction="right" />
				</Link>
			</div>
		</HeroLayout>
	);
}

// ── Variant: CaughtUp ────────────────────────────────────────────────────────

export function CaughtUpContent(): React.JSX.Element {
	return (
		<HeroLayout
			visual={(
				<div className="flex items-center justify-center">
					<Logo size={200} showWordmark={false} />
				</div>
			)}
		>
			<HeroKicker kanji="済" label="All clear" />

			<div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
				<h2
					id="hero-headline"
					className="break-words font-display text-hero leading-none text-sumi-ink"
				>
					Caught up.
					<span className="block text-faded-sumi font-normal">Enjoy your morning.</span>
				</h2>
			</div>

			<p className="mt-6 max-w-measure break-words text-base text-faded-sumi leading-relaxed">
				The desk is clear. Cards return when they are close to fading.
			</p>

			<HeroPrimaryAction href="/add" variant="secondary" desktopOnly>Add Japanese</HeroPrimaryAction>
		</HeroLayout>
	);
}

// ── Variant: FirstTime ───────────────────────────────────────────────────────

export function FirstTimeContent(): React.JSX.Element {
	return (
		<HeroLayout
			visual={(
				<div className="flex items-center justify-center">
					<Logo size={200} wordmarkSize="xl" />
				</div>
			)}
		>
			<HeroKicker kanji="始" label="Begin" />

			<p
				lang="ja"
				className="mt-6 font-display text-md leading-none text-faded-sumi sm:text-lg"
			>
				始めましょう。
			</p>

			<h2
				id="hero-headline"
				className="mt-2 break-words font-display text-hero leading-none text-sumi-ink"
			>
				Let&rsquo;s begin.
				<span className="block text-faded-sumi font-normal">
					Pick a deck Tomo prepared for you.
				</span>
			</h2>

			<p className="mt-6 max-w-measure break-words text-base leading-relaxed text-faded-sumi">
				JLPT vocabulary, Joyo kanji, grammar patterns, or your own Japanese. Either path opens the same way: calm, considered, no rush.
			</p>

			<HeroPrimaryAction href="/decks" desktopOnly>Browse premade decks</HeroPrimaryAction>
		</HeroLayout>
	);
}

// ── Variant: Resume ──────────────────────────────────────────────────────────

export function ResumeContent({ context }: { context: ResumeContextSnapshot }): React.JSX.Element {
	const remaining = safeNonNegativeInteger(context.remaining);
	const cardWord = remaining === 1 ? "card" : "cards";

	return (
		<HeroLayout
			visual={(
				<DeckStack
					decks={RESTING_DECKS}
					overflowDecks={0}
					resting
					emptyLabel="Session paused"
					emptyDescription="Pick up where you left off."
				/>
			)}
		>
			<HeroKicker kanji="続" label="Resume practice" />

			<h2
				id="hero-headline"
				className="mt-6 break-words font-display text-hero leading-none text-sumi-ink"
			>
				{formatExactCount(remaining)}
				{" "}
				{cardWord}
				{" "}
				left
				<span className="block font-normal text-faded-sumi">in your last session.</span>
			</h2>

			<HeroPrimaryAction href="/review/session" desktopOnly>Resume review</HeroPrimaryAction>

			<div className="mt-3">
				<QuietLink href="/review/setup" tone="sumi">
					Start a new session instead
				</QuietLink>
			</div>
		</HeroLayout>
	);
}

// ── Shared layout: HeroLayout, HeroKicker, HeroPrimaryAction ─

function HeroLayout({
	visual,
	children,
}: {
	visual: React.ReactNode;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className="grid gap-7 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-center">
			<div
				className="order-1 min-w-0 px-1 py-2 sm:px-2 lg:py-4 xl:order-none xl:col-start-1 xl:row-start-1"
			>
				{children}
			</div>

			<div
				aria-hidden="true"
				className={[
					"order-2 relative hidden items-center justify-center overflow-visible",
					"sm:flex sm:min-h-[320px] sm:py-4 lg:min-h-[350px]",
					"xl:order-none xl:col-start-2 xl:row-start-1",
				].join(" ")}
			>
				{visual}
			</div>
		</div>
	);
}

function HeroKicker({
	kanji,
	label,
	flag,
	tone = "default",
}: {
	kanji: string;
	label: string;
	/**
	 * Optional metadata note rendered inline after the label, separated by a
	 * faded middot. Used for trust signals about the hero's payload (e.g.
	 * "Last saved route" when data is stale) so the flag is absorbed BEFORE
	 * the headline count is read. Stays in the same typographic register as
	 * the route label, just quieter and tinted aizome.
	 */
	flag?: string;
	tone?: "default" | "error";
}): React.JSX.Element {
	const isError = tone === "error";
	const trimmedFlag = flag?.trim();
	const hasFlag = trimmedFlag !== undefined && trimmedFlag.length > 0;

	return (
		<header>
			<p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<span
					lang="ja"
					aria-hidden="true"
					className={[
						"select-none font-display text-2xl leading-none",
						isError ? "text-error" : "text-inari-vermillion",
					].join(" ")}
				>
					{kanji}
				</span>
				<span
					className={[
						"font-mono text-sm font-medium uppercase tracking-normal",
						isError ? "text-error-deep/85" : "text-sumi-ink/80",
					].join(" ")}
				>
					{label}
				</span>
				{hasFlag && (
					<>
						<span aria-hidden="true" className="font-mono text-sm leading-none text-faded-sumi/70">·</span>
						<span className="font-mono text-sm uppercase tracking-normal text-aizome-indigo/85">
							{trimmedFlag}
						</span>
					</>
				)}
			</p>
			<hr
				aria-hidden="true"
				className={[
					"mt-3.5 border-0 border-t",
					isError ? "border-error/25" : "border-soft-hairline",
				].join(" ")}
			/>
		</header>
	);
}

function HeroPrimaryAction({
	href,
	variant = "primary",
	children,
	desktopOnly = false,
}: {
	href: string;
	variant?: "primary" | "secondary";
	children: React.ReactNode;
	/**
	 * When true, the inline CTA only renders at lg+ — phone / tablet rely on
	 * the MobileStickyActionBar rendered at the route level so the CTA is
	 * always above the fold on small viewports. Default false (visible at
	 * every breakpoint) for variants that don't have a sticky mirror.
	 */
	desktopOnly?: boolean;
}): React.JSX.Element {
	return (
		<div
			className={[
				"mt-8",
				desktopOnly
					? "hidden lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4"
					: "flex flex-col gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4",
			].join(" ")}
		>
			<Link href={href} className={heroCtaClass(variant)}>
				{children}
				<ArrowGlyph direction="right" />
			</Link>
		</div>
	);
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeDueQueue(queue: DueQueue): DueQueue {
	const newCnt = safeNonNegativeInteger(queue.newCnt);
	const review = safeNonNegativeInteger(queue.review);
	const backlog = safeNonNegativeInteger(queue.backlog);
	const explicitTotal = newCnt + review + backlog;
	const total = Math.max(safeNonNegativeInteger(queue.total), explicitTotal);
	const statusNote = queue.statusNote?.trim();

	return {
		...queue,
		total,
		newCnt,
		review,
		backlog,
		statusNote: statusNote !== undefined && statusNote.length > 0 ? statusNote : undefined,
		decks: queue.decks,
		overflowDecks: safeNonNegativeInteger(queue.overflowDecks),
	};
}

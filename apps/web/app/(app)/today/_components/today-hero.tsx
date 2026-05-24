'use client';

import Link from 'next/link';

import { Logo } from '@/components/ui/Logo';

import type { ApiTomoNote, ApiWeakSpotListItem } from '@fsrs-japanese/shared-types';

import { ArrowGlyph } from '@/components/icons/arrow-glyph';
import { FuriganaText } from '@/components/ui/FuriganaText';
import { JlptPill, type JlptPillLevel } from '@/components/ui/Pill';
import { QuietLink } from '@/components/ui/QuietLink';
import { CompositionStrip } from '@/components/review/CompositionStrip';
import { TeacherNote } from '@/components/review/TeacherNote';
import { useTomoNoteQuery } from '@/lib/api/tomo';
import { useWeakSpotsQuery } from '@/lib/api/weak-spots';

import {
    formatCompactCount,
    formatExactCount,
    safeNonNegativeInteger
} from './today-format';

// File map:
//   Types → resting/starter decks → DashboardHero (entry) →
//   variant content (Due, CaughtUp, FirstTime, Loading, Error, Resume) →
//   shared layout (HeroLayout, HeroKicker, HeroPreSessionNote,
//   HeroPrimaryAction) → deck stack visuals → loading/error visuals →
//   normalizers → color tokens.

// ── CTA classes ──────────────────────────────────────────────────────────────
// Hero CTAs render as <Link> (Next.js navigation), so the design-system
// <Button> primitive can't host them directly. To stay aligned, the palette
// here mirrors Button's `primary` / `secondary` variants exactly:
//   • primary  — bg-inari-vermillion, deepens on hover (per Buttons spec)
//   • secondary — warm-paper-raised, cream-inset on hover
// No translate or scale transforms: DESIGN.md "no scale transform. The press
// is felt as ink, not as movement." Color shift carries the press.

const HERO_CTA_BASE = [
    'inline-flex min-h-14 w-full max-w-full items-center justify-center gap-3 rounded-[2px] px-6 py-3',
    'sm:w-auto sm:min-w-[min(280px,100%)] sm:px-10',
    'text-base font-semibold',
    'today-motion-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
].join(' ');

const HERO_CTA_PRIMARY = [
    'bg-inari-vermillion text-warm-paper-raised',
    'hover:bg-inari-vermillion-deep',
    'active:bg-inari-vermillion-deep active:shadow-[inset_0_1px_2px_rgba(31,26,24,0.12)]',
].join(' ');

const HERO_CTA_SECONDARY = [
    'border border-soft-hairline bg-warm-paper-raised text-sumi-ink',
    'hover:border-faded-sumi hover:bg-cream-inset',
    'active:bg-soft-hairline',
].join(' ');

function heroCtaClass(variant: 'primary' | 'secondary'): string {
    return [HERO_CTA_BASE, variant === 'primary' ? HERO_CTA_PRIMARY : HERO_CTA_SECONDARY].join(' ');
}

// ── Preparation lines ────────────────────────────────────────────────────────
// Fallback frames for the pre-session note slot. Used when the weak-spots
// query is still loading or the Tomo note quota is spent — the slot never
// collapses, so the hero's vertical rhythm stays stable.
const PREPARATION_LINES = [
    'Each card seen is one settled.',
    'Be honest with the ratings. The schedule does the rest.',
    'Recall is a muscle; this is the practice.',
    'The harder ones teach the most.',
    'Sit with each card. The work happens in the recall.',
    'Some cards will feel new again. That is allowed.',
    'One card, then the next. No race here.'
] as const;

const DEFAULT_PREPARATION_LINE: string = PREPARATION_LINES[0];

// Deterministic pick from the line pool — pure so tests/previews can pass
// any seed.
function pickPreparationLine(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return PREPARATION_LINES[hash % PREPARATION_LINES.length] ?? DEFAULT_PREPARATION_LINE;
}

// Weak-spots probe size: 2 visible word peeks + 1 overflow detector.
// Exported so today-client can mirror the same query args; TanStack
// Query then dedups the request and the pre-review-note data is ready
// by the time HeroPreSessionNote mounts (no placeholder flash).
const WEAK_SPOT_PEEK_LIMIT = 2;
export const WEAK_SPOT_QUERY_LIMIT = WEAK_SPOT_PEEK_LIMIT + 1;

// ── Types ────────────────────────────────────────────────────────────────────

export type HeroKind = 'due' | 'caught-up' | 'first-time' | 'resume'

export interface ResumeContextSnapshot {
    remaining: number;
}

export type HeroDeckTag =
    | {kind: 'level'; level: JlptPillLevel}
    | {kind: 'none'}

export interface HeroDeckPreview {
    id: string;
    title: string;
    subtitle: string;
    dueCount: number;
    newCount?: number;
    reviewCount?: number;
    tag: HeroDeckTag;
}

export interface DueQueue {
    total: number;
    newCnt: number;
    review: number;
    backlog: number;
    statusNote?: string | undefined;
    decks: HeroDeckPreview[];
    overflowDecks: number;
}

export type DashboardHeroVariant =
    | {kind: 'due'; queue: DueQueue}
    | {kind: 'caught-up'}
    | {kind: 'first-time'}
    | {kind: 'resume'; context: ResumeContextSnapshot}

/**
 * CTA descriptor for each hero variant. Used by the route-level
 * MobileStickyActionBar so the phone/tablet sticky bar always carries the
 * SAME primary action the desktop hero would show. Keep in sync with the
 * inline <HeroPrimaryAction> calls inside each variant component below.
 */
export interface HeroCta {
    href:     string
    label:    string
    tone:     'primary' | 'secondary'
}

export function getHeroCta(variant: DashboardHeroVariant): HeroCta {
    switch (variant.kind) {
        case 'due':        return { href: '/review/session',          label: 'Start reviews', tone: 'primary'   }
        case 'caught-up':  return { href: '/add',                      label: 'Add Japanese', tone: 'secondary' }
        case 'first-time': return { href: '/decks',                   label: 'Browse decks',  tone: 'primary'   }
        case 'resume':     return { href: '/review/session',          label: 'Resume review', tone: 'primary'   }
    }
}

interface DashboardHeroProps {
    variant: DashboardHeroVariant;
    /**
     * Learner-local calendar key (YYYY-MM-DD). Threaded down for the
     * pre-session note so the Tomo note cache rotates at local midnight.
     * Omit or pass `undefined` from dev/showcase surfaces that don't wire
     * a real calendar — the slot falls back to the preparation line in
     * that case. The explicit `| undefined` is required to interop with
     * `exactOptionalPropertyTypes` when the value originates from a
     * possibly-undefined source.
     */
    dateKey?: string | undefined;
}

// ── Placeholder decks ────────────────────────────────────────────────────────

const RESTING_DECKS: HeroDeckPreview[] = [
    {
        id : 'resting-review',
        title : 'Review deck',
        subtitle : 'Nothing is due right now',
        dueCount : 0,
        tag : {kind : 'none'}
    },
    {
        id : 'resting-schedule',
        title : 'Next review',
        subtitle : 'Cards return at the right time',
        dueCount : 0,
        tag : {kind : 'none'}
    }
];

// ── Entry component ──────────────────────────────────────────────────────────

export function DashboardHero({variant, dateKey}: DashboardHeroProps): React.JSX.Element {
    return (
        <section
            aria-labelledby="hero-headline"
            className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-base px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7"
        >
            <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 z-20 h-[2px] bg-inari-vermillion"
            />

            <div className="relative z-10">
                {variant.kind === 'due' && <DueContent queue={variant.queue} dateKey={dateKey}/>}
                {variant.kind === 'caught-up' && <CaughtUpContent/>}
                {variant.kind === 'first-time' && <FirstTimeContent/>}
                {variant.kind === 'resume' && <ResumeContent context={variant.context}/>}
            </div>
        </section>
    );
}

// ── Variant: Due ─────────────────────────────────────────────────────────────

function DueContent({queue, dateKey}: {
    queue: DueQueue
    dateKey: string | undefined
}): React.JSX.Element {
    const safeQueue = normalizeDueQueue(queue);
    const cardWord = safeQueue.total === 1 ? 'card' : 'cards';

    return (
        <HeroLayout
            visual={
                <DeckStack
                    decks={safeQueue.decks}
                    overflowDecks={safeQueue.overflowDecks}
                    emptyLabel="Queue details unavailable"
                    emptyDescription="Reviews can still start from the total count."
                />
            }
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
                {formatExactCount(safeQueue.total)} {cardWord} due
            </h2>

            <CompositionStrip
                breakdown={{
                    newCount:     safeQueue.newCnt,
                    reviewCount:  safeQueue.review,
                    backlogCount: safeQueue.backlog,
                }}
                className="mt-6"
            />

            <HeroPreSessionNote dateKey={dateKey}/>

            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                <Link
                    href="/review/session"
                    className={`hidden lg:inline-flex ${heroCtaClass('primary')}`}
                >
                    Start reviews
                    <ArrowGlyph direction="right"/>
                </Link>

                <Link
                    href="/review/setup"
                    className={heroCtaClass('secondary')}
                >
                    Customize this session
                    <ArrowGlyph direction="right"/>
                </Link>
            </div>
        </HeroLayout>
    );
}

// ── Variant: CaughtUp ────────────────────────────────────────────────────────

function CaughtUpContent(): React.JSX.Element {
    return (
        <HeroLayout
            visual={
                <div className="flex items-center justify-center">
                    <Logo size={200} showWordmark={false}/>
                </div>
            }
        >
            <HeroKicker kanji="済" label="All clear"/>

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

function FirstTimeContent(): React.JSX.Element {
    return (
        <HeroLayout
            visual={
                <div className="flex items-center justify-center">
                    <Logo size={200} wordmarkSize="xl"/>
                </div>
            }
        >
            <HeroKicker kanji="始" label="Begin"/>

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

function ResumeContent({context}: {context: ResumeContextSnapshot}): React.JSX.Element {
    const remaining = safeNonNegativeInteger(context.remaining);
    const cardWord = remaining === 1 ? 'card' : 'cards';

    return (
        <HeroLayout
            visual={
                <DeckStack
                    decks={RESTING_DECKS}
                    overflowDecks={0}
                    resting
                    emptyLabel="Session paused"
                    emptyDescription="Pick up where you left off."
                />
            }
        >
            <HeroKicker kanji="続" label="Resume practice"/>

            <h2
                id="hero-headline"
                className="mt-6 break-words font-display text-hero leading-none text-sumi-ink"
            >
                {formatExactCount(remaining)} {cardWord} left
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
                        children
                    }: {
    visual: React.ReactNode
    children: React.ReactNode
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
                    'order-2 relative hidden items-center justify-center overflow-visible',
                    'sm:flex sm:min-h-[320px] sm:py-4 lg:min-h-[350px]',
                    'xl:order-none xl:col-start-2 xl:row-start-1'
                ].join(' ')}
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
                        tone = 'default'
                    }: {
    kanji: string
    label: string
    /**
     * Optional metadata note rendered inline after the label, separated by a
     * faded middot. Used for trust signals about the hero's payload (e.g.
     * "Last saved route" when data is stale) so the flag is absorbed BEFORE
     * the headline count is read. Stays in the same typographic register as
     * the route label, just quieter and tinted aizome.
     */
    flag?: string
    tone?: 'default' | 'error'
}): React.JSX.Element {
    const isError = tone === 'error';
    const trimmedFlag = flag?.trim();
    const hasFlag = trimmedFlag !== undefined && trimmedFlag.length > 0;

    return (
        <header>
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span
                    lang="ja"
                    aria-hidden="true"
                    className={[
                        'select-none font-display text-2xl leading-none',
                        isError ? 'text-error' : 'text-inari-vermillion'
                    ].join(' ')}
                >
                    {kanji}
                </span>
                <span
                    className={[
                        'font-mono text-sm font-medium uppercase tracking-normal',
                        isError ? 'text-error-deep/85' : 'text-sumi-ink/80'
                    ].join(' ')}
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
                    'mt-3.5 border-0 border-t',
                    isError ? 'border-error/25' : 'border-soft-hairline'
                ].join(' ')}
            />
        </header>
    );
}

// ── Hero pre-session note ────────────────────────────────────────────────────
//
// Sits between the headline and the queue chips inside the Due hero. Picks
// one of three contents based on the learner's current state:
//
//   1. Unresolved weak spots → a one-line signal with a word peek (up to two
//      Japanese words + a "+N more" overflow) and an inline drill CTA. The
//      operational signal wins because it is actionable and the next thing
//      the learner should consider before starting.
//   2. Today's Tomo note → the daily teacher-voice prose, rendered as one
//      calm line. Stripped of the standalone-passage chrome (ISO stamp,
//      Japanese weekday, Kotowaza pill, end seal) — those existed when the
//      note lived in its own block; inside the hero they would compete with
//      the headline and the kicker. The body alone reads as a passage when
//      the hero is otherwise quiet.
//   3. Fallback — a date-seeded teacher-voice preparation line. Used while
//      the queries are loading, when the AI quota is spent, or in any
//      hero-preview surface that doesn't wire a real calendar. Keeps the
//      slot's vertical rhythm stable so the chips/CTA don't shift when data
//      arrives.
//
// Elevated visual weight (sumi-ink, slightly larger than body) is deliberate
// — this is the orientation the learner reads before starting, not filler.

function HeroPreSessionNote({dateKey}: {dateKey: string | undefined}): React.JSX.Element {
    // Both queries are awaited at the route level by today-client's PageGate
    // (see today-client.tsx, `pageReady`). By the time this component
    // mounts, the TanStack Query cache is warm and these hooks return
    // resolved data on first render — no loading branch needed.
    const weakSpotsQuery = useWeakSpotsQuery({
        status: 'unresolved',
        limit:  WEAK_SPOT_QUERY_LIMIT,
        sort:   'mostRecent',
    });
    const weakSpotItems = weakSpotsQuery.data?.items ?? [];
    const hasWeakSpots  = weakSpotItems.length > 0;

    // Only spend the AI quota on calm days. The route gate mirrors this
    // exact condition (see `tomoNoteEnabled` in today-client).
    const tomoNoteEnabled = !hasWeakSpots && dateKey !== undefined && !weakSpotsQuery.isError;
    const tomoNoteQuery   = useTomoNoteQuery({
        dateKey: dateKey ?? '',
        enabled: tomoNoteEnabled,
    });

    if (hasWeakSpots) {
        return (
            <WeakSpotsNoteRow
                items={weakSpotItems}
                hasMore={(weakSpotsQuery.data?.totalCount ?? 0) > weakSpotItems.length}
            />
        );
    }

    if (tomoNoteEnabled) {
        const note = tomoNoteQuery.data;
        if (note !== null && note !== undefined) {
            return <TomoNoteRow note={note}/>;
        }
    }

    return <FallbackPreparationRow dateKey={dateKey}/>;
}

function WeakSpotsNoteRow({
                              items,
                              hasMore
                          }: {
    items: readonly ApiWeakSpotListItem[]
    hasMore: boolean
}): React.JSX.Element {
    const visible = items.slice(0, WEAK_SPOT_PEEK_LIMIT);
    const overflowCount = Math.max(0, items.length - visible.length) + (hasMore ? 1 : 0);

    // Approximate total. Exact count would need a separate query; for a
    // pre-session note the magnitude ("how many") matters more than the
    // last digit. `3+` reads as "at least three" without overpromising
    // precision the API doesn't return on this path.
    const approxTotal = visible.length + overflowCount;
    const totalLabel = hasMore ? `${approxTotal}+` : `${approxTotal}`;
    const verbAgreement = approxTotal === 1 ? 'keeps' : 'keep';
    const cardWord = approxTotal === 1 ? 'card' : 'cards';
    const drillCopy = approxTotal === 1 ? 'Drill it first' : 'Drill them first';

    const wordPeeks = visible.map((spot, index) => {
        const isLast = index === visible.length - 1 && overflowCount === 0;
        return (
            <span key={spot.id} className="font-display not-italic text-sumi-ink">
        {spot.word !== null && spot.reading !== null ? (
            <FuriganaText text={spot.word} reading={spot.reading} rtSize="0.36em"/>
        ) : (
            <span className={spot.word === null ? 'italic text-faded-sumi' : ''}>
            {spot.word ?? '—'}
          </span>
        )}
                {!isLast && <span aria-hidden="true">, </span>}
      </span>
        );
    });

    // Same quote treatment as FallbackPreparationRow: hanging `「` in the left
    // grid column, italic prose, closing `」` inline at the end. Numbers,
    // word peeks, and the drill link below stay upright via `not-italic` so
    // the italic only carries the prose voice, not the data tokens or the
    // affordance.
    return (
        <blockquote
            cite="Tomo"
            className="mt-6 mb-6 max-w-measure break-words italic text-base leading-[1.55] text-sumi-ink sm:text-md"
        >
            <p>
                <span
                    aria-hidden="true"
                    lang="ja"
                    className="mr-0.5 inline-block text-[1.25em] leading-none select-none not-italic text-inari-vermillion/85"
                >
                    「
                </span>
                <span className="tabular-nums font-medium">{totalLabel}</span>{' '}
                {cardWord} {verbAgreement} catching you
                {visible.length > 0 ? (
                    <>
                        {': '}
                        {wordPeeks}
                        {overflowCount > 0 && (
                            <span className="tabular-nums text-faded-sumi">
                                {visible.length > 0 ? ', ' : ''}+{overflowCount}
                            </span>
                        )}
                    </>
                ) : null}
                .
                <span
                    aria-hidden="true"
                    lang="ja"
                    className="ml-0.5 inline-block text-[1.25em] leading-none select-none not-italic text-inari-vermillion/85"
                >
                    」
                </span>
            </p>
            <p className="mt-2">
                <QuietLink href="/weak-spots/drill/setup" tone="brand" trailingArrow>
                    {drillCopy}
                </QuietLink>
            </p>
        </blockquote>
    );
}

function TomoNoteRow({note}: {note: ApiTomoNote}): React.JSX.Element {
    return <TeacherNote kanji="言" label="For today">{note.body}</TeacherNote>;
}

function FallbackPreparationRow({dateKey}: {dateKey: string | undefined}): React.JSX.Element {
    // Pure render. dateKey arrives from the route's server component (built
    // with the user's timezone), so the picked line is identical on SSR and
    // on client first render — no hydration swap, no placeholder flash.
    const line = dateKey !== undefined
        ? pickPreparationLine(dateKey)
        : DEFAULT_PREPARATION_LINE;
    return <TeacherNote kanji="言" label="For today">{line}</TeacherNote>;
}

function HeroPrimaryAction({
                               href,
                               variant = 'primary',
                               children,
                               desktopOnly = false
                           }: {
    href: string
    variant?: 'primary' | 'secondary'
    children: React.ReactNode
    /**
     * When true, the inline CTA only renders at lg+ — phone / tablet rely on
     * the MobileStickyActionBar rendered at the route level so the CTA is
     * always above the fold on small viewports. Default false (visible at
     * every breakpoint) for variants that don't have a sticky mirror.
     */
    desktopOnly?: boolean
}): React.JSX.Element {
    return (
        <div
            className={[
                'mt-8',
                desktopOnly
                    ? 'hidden lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4'
                    : 'flex flex-col gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4',
            ].join(' ')}
        >
            <Link href={href} className={heroCtaClass(variant)}>
                {children}
                <ArrowGlyph direction="right"/>
            </Link>
        </div>
    );
}

// ── Deck stack ───────────────────────────────────────────────────────────────

function DeckStack({
                       decks,
                       overflowDecks,
                       resting = false,
                       emptyLabel = 'No deck data',
                       emptyDescription = 'Reviews can still start from the queue total.'
                   }: {
    decks: HeroDeckPreview[]
    overflowDecks: number
    resting?: boolean
    emptyLabel?: string
    emptyDescription?: string
}): React.JSX.Element {
    const visibleDecks = decks.slice(0, 3).map(normalizeHeroDeck);
    const safeOverflowDecks = safeNonNegativeInteger(overflowDecks);

    if (visibleDecks.length === 0) {
        return (
            <div className="today-hero-deck-stack relative z-10 flex h-[16.75rem] w-full max-w-[27.5rem] items-center justify-center" aria-hidden="true">
                <div className="today-hero-card-shell today-hero-card-single w-full max-w-[24.5rem]">
                    <div className="today-hero-card-surface relative overflow-hidden rounded-[2px] border border-dashed border-soft-hairline bg-warm-paper-raised/70 p-5">
                        <div className="mx-auto mb-4 flex h-16 max-w-[13rem] items-end justify-center gap-2 border-b border-soft-hairline/70" aria-hidden="true">
                            <span className="block h-9 w-12 rotate-[-3deg] rounded-[1px] border border-soft-hairline bg-cream-inset"/>
                            <span className="block h-12 w-12 rotate-[2deg] rounded-[1px] border border-inari-vermillion/30 bg-inari-vermillion/10"/>
                            <span className="block h-8 w-12 rotate-[-1deg] rounded-[1px] border border-soft-hairline bg-warm-paper-base"/>
                        </div>
                        <p className="font-mono text-xs text-faded-sumi">
                            {emptyLabel}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-faded-sumi">
                            {emptyDescription}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const visibleDeckCount = visibleDecks.length;

    return (
        <div className="today-hero-deck-stack relative z-10 h-[17.25rem] w-full max-w-[28rem]" aria-hidden="true">
            {visibleDecks.map((deck, index) => (
                <DeckStackCard
                    key={`${deck.id}-${index}`}
                    deck={deck}
                    index={index}
                    visibleDeckCount={visibleDeckCount}
                    resting={resting}
                    overflowDecks={index === 0 ? safeOverflowDecks : 0}
                />
            ))}
        </div>
    );
}

const STACK_POSITIONS = [
    'z-40 left-1/2 top-[98px] -translate-x-1/2 rotate-[-0.8deg]',
    'z-30 left-[55%] top-[64px] -translate-x-1/2 rotate-[1.6deg]',
    'z-20 left-[47%] top-[38px] -translate-x-1/2 rotate-[-2deg]'
] as const;
const TWO_DECK_POSITIONS = [
    'z-40 left-[47%] top-1/2 -translate-x-1/2 -translate-y-[30%] rotate-[-0.8deg]',
    'z-30 left-[56%] top-1/2 -translate-x-1/2 -translate-y-[52%] rotate-[1.6deg]'
] as const;
const SINGLE_DECK_POSITION = 'z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0';

function DeckStackCard({
                           deck,
                           index,
                           visibleDeckCount,
                           resting,
                           overflowDecks
                       }: {
    deck: HeroDeckPreview
    index: number
    visibleDeckCount: number
    resting: boolean
    overflowDecks: number
}): React.JSX.Element {
    const countLabel = deck.dueCount === 0
        ? (resting ? 'settled' : 'no due cards')
        : `${formatCompactCount(deck.dueCount)} due`;

    return (
        <article
            className={[
                `today-hero-card-shell today-hero-card-${index} absolute w-[min(84%,22rem)]`,
                deckPositionClass(index, visibleDeckCount)
            ].join(' ')}
        >
            <div
                className={[
                    'today-hero-card-surface relative overflow-hidden rounded-[2px]',
                    'border border-soft-hairline/85 bg-warm-paper-raised p-4'
                ].join(' ')}
                style={{borderTopColor : markColorForTag(deck.tag)}}
            >
                <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-sumi-ink/60">
            Deck
          </span>
                    <HeroDeckTagPill tag={deck.tag}/>
                </div>

                <h3 className="mt-4 truncate text-base font-semibold text-sumi-ink">
                    {deck.title}
                </h3>
                <p className="mt-1 truncate text-sm text-faded-sumi">
                    {deck.subtitle}
                </p>

                <div className="mt-5 flex items-end justify-between gap-4">
                    <p className="font-mono text-sm tabular-nums text-sumi-ink">
                        {countLabel}
                    </p>
                    {overflowDecks > 0 && (
                        <p className="font-mono text-xs tabular-nums text-faded-sumi">
                            +{formatCompactCount(overflowDecks)} more
                        </p>
                    )}
                </div>
            </div>
        </article>
    );
}

function deckPositionClass(index: number, visibleDeckCount: number): string {
    if (visibleDeckCount === 1) {
        return SINGLE_DECK_POSITION;
    }

    if (visibleDeckCount === 2) {
        return TWO_DECK_POSITIONS[index] ?? TWO_DECK_POSITIONS[0];
    }

    return STACK_POSITIONS[index] ?? STACK_POSITIONS[0];
}

function HeroDeckTagPill({tag}: {tag: HeroDeckTag}): React.JSX.Element {
    if (tag.kind === 'level') {
        return <JlptPill level={tag.level} size="sm"/>;
    }

    return <span className="h-5" aria-hidden="true"/>;
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
        statusNote : statusNote !== undefined && statusNote.length > 0 ? statusNote : undefined,
        decks : queue.decks,
        overflowDecks : safeNonNegativeInteger(queue.overflowDecks)
    };
}

function normalizeHeroDeck(deck: HeroDeckPreview): HeroDeckPreview {
    const {
              dueCount,
              id,
              newCount,
              reviewCount,
              subtitle,
              title,
              ...rest
          } = deck;

    return {
        ...rest,
        id : id.trim(),
        title : title.trim() || 'Untitled deck',
        subtitle : subtitle.trim() || 'Review queue',
        dueCount : safeNonNegativeInteger(dueCount),
        ...(newCount === undefined ? {} : {newCount : safeNonNegativeInteger(newCount)}),
        ...(reviewCount === undefined ? {} : {reviewCount : safeNonNegativeInteger(reviewCount)})
    };
}

// ── Color tokens ─────────────────────────────────────────────────────────────

const LEVEL_MARK_COLORS: Record<JlptPillLevel, string> = {
    N5 : 'var(--color-deck-n5-mark)',
    N4 : 'var(--color-deck-n4-mark)',
    N3 : 'var(--color-deck-n3-mark)',
    N2 : 'var(--color-deck-n2-mark)',
    N1 : 'var(--color-deck-n1-mark)',
    beyond : 'var(--color-deck-beyond-mark)',
    beyond_jlpt : 'var(--color-deck-beyond-mark)',
    kana : 'var(--color-deck-n4-mark)'
};

function markColorForTag(tag: HeroDeckTag): string {
    return tag.kind === 'level'
        ? LEVEL_MARK_COLORS[tag.level]
        : 'var(--color-soft-hairline)';
}

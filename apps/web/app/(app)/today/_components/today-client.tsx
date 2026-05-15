'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ApiDeck, ApiDueCard } from '@fsrs-japanese/shared-types';

import { useDecks } from '@/lib/api/decks';
import { useDueCards, useReviewForecast } from '@/lib/api/reviews';
import { inferDeckLevel } from '@/lib/deck-level';
import { useResumeContext } from '@/stores/useReviewSessionStore';

import { OfflineStatusBand } from './offline-status-band';
import {
    addDaysToDateKey,
    buildDashboardCalendarContext,
    calendarDateKeyFromApiDate,
    isDashboardDateKey,
    normalizeDashboardTimeZone,
    type DashboardCalendarContext
} from './today-calendar';
import {
    DashboardHero,
    type DashboardHeroVariant,
    type DueQueue,
    type HeroDeckTag,
    type HeroDeckPreview
} from './today-hero';
import type { HeroDevControls } from './today-hero-dev-toolbar';
import type {
    ModuleDevControls,
    WeekRhythmPattern,
    WeekRhythmPreviewState
} from './today-modules-dev-toolbar';
import { TodayDevToolsDock } from './today-dev-tools-dock';
import { WeekRhythmStrip, type WeekRhythmState } from './week-rhythm-strip';

const FSRS_NEW = 0;
const HERO_PREVIEW_ENABLED = process.env.NODE_ENV !== 'production';
const DASHBOARD_DEV_TOOLS_TOGGLE_EVENT = 'tomo:dashboard-dev-tools:toggle';

interface QueueBreakdown {
    newCnt: number;
    review: number;
    backlog: number;
}

interface TodayClientProps {
    dateLabel: string;
    dateTime: string;
    greetingName: string | null;
    greetingPrefix: string;
    timeZone: string;
}

function dashboardCalendarContextMatches(
    current: DashboardCalendarContext,
    next: DashboardCalendarContext
): boolean {
    return current.dateLabel === next.dateLabel
        && current.dateTime === next.dateTime
        && current.greetingPrefix === next.greetingPrefix
        && current.todayKey === next.todayKey
        && current.yesterdayKey === next.yesterdayKey
        && current.timeZone === next.timeZone;
}

const DEFAULT_HERO_DEV_CONTROLS: HeroDevControls = {
    variant : 'due',
    queue : 'typical',
    decks : 'three',
    routeMix : 'balanced',
    flag : 'none'
};

const DEFAULT_MODULE_DEV_CONTROLS: ModuleDevControls = {
    weekState : 'default',
    weekPattern : 'typical'
};

/**
 * Build a 14-day preview series for the WeekRhythmStrip based on the dev
 * toolbar's selected pattern. Only the first 7 days are rendered by the
 * strip, but we generate 14 so the shape feels stable and consistent with
 * what the live forecast endpoint would return.
 */
function buildPreviewForecastDays(
    pattern: WeekRhythmPattern,
    todayKey: string
): Array<{
    date: string
    count: number
    backlogCount: number
    reviewCount: number
    newCount: number
}> {
    function shapeFor(i: number): {backlog: number; review: number; newCnt: number} {
        switch (pattern) {
            case 'typical':
                // Mid-volume mixed days with today highest.
                return {
                    backlog : i === 0 ? 4 : 0,
                    review : [22, 14, 18, 9, 16, 12, 7, 11, 13, 8, 10, 14, 6, 9][i] ?? 8,
                    newCnt : i < 7 ? (i === 0 ? 4 : 2) : 1
                };
            case 'busy-today':
                return {
                    backlog : i === 0 ? 8 : 0,
                    review : i === 0 ? 46 : [4, 6, 3, 5, 4, 2, 3][i] ?? 3,
                    newCnt : i === 0 ? 6 : 1
                };
            case 'backlog-heavy':
                // Heavy overdue today, tapering off through the week.
                return {
                    backlog : i === 0 ? 28 : i === 1 ? 6 : 0,
                    review : [14, 11, 13, 9, 10, 8, 6, 10, 9, 7, 8, 6, 5, 7][i] ?? 6,
                    newCnt : i === 0 ? 3 : 1
                };
            case 'new-heavy':
                // A lot of new cards every day — onboarding-fresh learner.
                return {
                    backlog : 0,
                    review : [6, 5, 7, 4, 6, 5, 4, 5, 6, 4, 5, 6, 3, 4][i] ?? 4,
                    newCnt : i < 7 ? 10 : 8
                };
            case 'ramp-up':
                // Load grows day by day.
                return {
                    backlog : i === 0 ? 2 : 0,
                    review : Math.round(4 + i * 4.5),
                    newCnt : i < 7 ? 1 + Math.floor(i / 2) : 2
                };
            case 'winding-down':
                // Load decreases day by day.
                return {
                    backlog : i === 0 ? 6 : 0,
                    review : Math.max(2, Math.round(36 - i * 4)),
                    newCnt : i < 7 ? Math.max(0, 5 - i) : 0
                };
            case 'caught-up':
                return {backlog : 0, review : 0, newCnt : 0};
        }
    }

    const out: ReturnType<typeof buildPreviewForecastDays> = [];
    for (let i = 0; i < 14; i += 1) {
        const date = addDaysToDateKey(todayKey, i);
        const shape = shapeFor(i);
        const count = shape.backlog + shape.review + shape.newCnt;
        out.push({
            date,
            count,
            backlogCount : shape.backlog,
            reviewCount : shape.review,
            newCount : shape.newCnt
        });
    }
    return out;
}

function moduleStateToWeekRhythmState(state: WeekRhythmPreviewState): WeekRhythmState {
    return state;
}

function buildHeroQueueFromDueCards(
    items: ApiDueCard[],
    todayKey: string,
    timeZone: string,
    deckById: ReadonlyMap<string, ApiDeck>
): DueQueue {
    const breakdown = countQueueBreakdown(items, todayKey, timeZone);
    const grouped = groupDueCards(items);
    const deckEntries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
    const decks = deckEntries.slice(0, 3).map(([, cards], index) => toHeroDeck(cards, index, deckById));

    return {
        total : breakdown.newCnt + breakdown.review + breakdown.backlog,
        newCnt : breakdown.newCnt,
        review : breakdown.review,
        backlog : breakdown.backlog,
        decks,
        overflowDecks : Math.max(0, deckEntries.length - decks.length)
    };
}

function countQueueBreakdown(
    items: ApiDueCard[],
    todayKey: string,
    timeZone: string
): QueueBreakdown {
    let backlog = 0;
    let newCnt = 0;
    let review = 0;

    for (const card of items) {
        if (card.state === FSRS_NEW) {
            newCnt += 1;
        } else if (isOverdue(card, todayKey, timeZone)) {
            backlog += 1;
        } else {
            review += 1;
        }
    }

    return {newCnt, review, backlog};
}

function groupDueCards(items: ApiDueCard[]): Map<string, ApiDueCard[]> {
    const out = new Map<string, ApiDueCard[]>();
    for (const card of items) {
        const key = card.deckId ?? `${card.jlptLevel ?? 'mixed'}-${card.layoutType}`;
        const bucket = out.get(key);
        if (bucket === undefined) {
            out.set(key, [card]);
        } else {
            bucket.push(card);
        }
    }
    return out;
}

function toHeroDeck(
    cards: ApiDueCard[],
    index: number,
    deckById: ReadonlyMap<string, ApiDeck>
): HeroDeckPreview {
    const layout = dominant(cards.map((card) => card.layoutType));
    const newCount = cards.filter((card) => card.state === FSRS_NEW).length;
    const deckId = cards[0]?.deckId;
    const sourceDeck = deckId != null ? deckById.get(deckId) : undefined;
    const title = sourceDeck?.name ?? (deckId != null ? 'Active deck' : `${formatLayoutType(layout)} queue`);
    const level = dominant(
        cards
            .map((card) => card.jlptLevel)
            .filter((cardLevel): cardLevel is NonNullable<ApiDueCard['jlptLevel']> => cardLevel !== null)
    ) ?? (sourceDeck !== undefined ? inferDeckLevel(sourceDeck) : null);
    const tag: HeroDeckTag = level !== null
        ? {kind : 'level', level}
        : {kind : 'none'};

    return {
        id : deckId ?? `queue-${index}`,
        title,
        subtitle : sourceDeck !== undefined
            ? 'Active deck queue'
            : (deckId != null ? 'Deck metadata unavailable' : 'Mixed queue'),
        dueCount : cards.length,
        newCount,
        reviewCount : cards.length - newCount,
        tag
    };
}

function isOverdue(card: ApiDueCard, todayKey: string, timeZone: string): boolean {
    const dueKey = calendarDateKeyFromApiDate(card.due, timeZone);
    return isDashboardDateKey(dueKey) && isDashboardDateKey(todayKey) && dueKey < todayKey;
}

function dominant<T extends string>(values: T[]): T | null {
    if (values.length === 0) return null;
    const counts = new Map<T, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function formatLayoutType(layout: ApiDueCard['layoutType'] | null): string {
    switch (layout) {
        case 'grammar':
            return 'Grammar';
        case 'sentence':
            return 'Sentence';
        case 'vocabulary':
            return 'Vocabulary';
        default:
            return 'Mixed';
    }
}

function buildPreviewHeroVariant(controls: HeroDevControls): DashboardHeroVariant {
    switch (controls.variant) {
        case 'due':
            return {kind : 'due', queue : buildPreviewQueue(controls)};
        case 'caught-up':
            return {kind : 'caught-up'};
        case 'first-time':
            return {kind : 'first-time'};
        case 'loading':
            return {kind : 'loading'};
        case 'error':
            return {kind : 'error'};
        case 'resume':
            return {kind : 'resume', context : {remaining : previewResumeRemaining(controls)}};
    }
}

function previewResumeRemaining(controls: HeroDevControls): number {
    switch (controls.queue) {
        case 'one':
            return 1;
        case 'no-backlog':
            return 8;
        case 'typical':
            return 12;
        case 'backlog-heavy':
            return 22;
        case 'large':
            return 38;
    }
}

function buildPreviewQueue(controls: HeroDevControls): DueQueue {
    const breakdown = previewQueueBreakdown(controls);
    const total = breakdown.newCnt + breakdown.review + breakdown.backlog;
    const {decks, overflowDecks} = previewDecks(controls.decks, total);

    return {
        total,
        newCnt : breakdown.newCnt,
        review : breakdown.review,
        backlog : breakdown.backlog,
        statusNote : controls.flag === 'stale-data' ? 'Showing the last saved route' : undefined,
        decks,
        overflowDecks
    };
}

function previewQueueBreakdown(controls: HeroDevControls): QueueBreakdown {
    const queueShape = queuePresetShape(controls.queue);
    const newCnt = previewNewCount(queueShape, controls.routeMix);
    const backlog = queueShape.backlog;
    const review = Math.max(0, queueShape.total - newCnt - backlog);
    return {newCnt, review, backlog};
}

function queuePresetShape(queue: HeroDevControls['queue']): {total: number; newCnt: number; backlog: number} {
    switch (queue) {
        case 'one':
            return {total : 1, newCnt : 0, backlog : 0};
        case 'no-backlog':
            return {total : 12, newCnt : 3, backlog : 0};
        case 'typical':
            return {total : 12, newCnt : 3, backlog : 2};
        case 'backlog-heavy':
            return {total : 34, newCnt : 2, backlog : 19};
        case 'large':
            return {total : 84, newCnt : 18, backlog : 11};
    }
}

function previewNewCount(
    shape: {total: number; newCnt: number; backlog: number},
    routeMix: HeroDevControls['routeMix']
): number {
    const todayCapacity = Math.max(0, shape.total - shape.backlog);
    if (todayCapacity <= 0) return 0;

    const ratio =
              routeMix === 'new-heavy' ? 0.55 :
                  routeMix === 'review-heavy' ? 0.10 :
                      null;

    if (ratio === null) return Math.min(shape.newCnt, todayCapacity);
    return Math.min(todayCapacity, Math.max(todayCapacity === 1 ? 0 : 1, Math.round(todayCapacity * ratio)));
}

function previewDecks(
    preset: HeroDevControls['decks'],
    total: number
): {decks: HeroDeckPreview[]; overflowDecks: number} {
    const samples: [HeroDeckPreview, HeroDeckPreview, HeroDeckPreview] = [
        {
            id : 'preview-n4-verbs',
            title : 'N4 verbs',
            subtitle : 'Conjugation and recall',
            dueCount : Math.max(1, Math.round(total * 0.45)),
            newCount : 2,
            reviewCount : Math.max(0, Math.round(total * 0.45) - 2),
            tag : {kind : 'level', level : 'N4'}
        },
        {
            id : 'preview-kanji',
            title : 'Joyo kanji',
            subtitle : 'Recognition practice',
            dueCount : Math.max(1, Math.round(total * 0.32)),
            newCount : 1,
            reviewCount : Math.max(0, Math.round(total * 0.32) - 1),
            tag : {kind : 'level', level : 'N3'}
        },
        {
            id : 'preview-grammar',
            title : 'Grammar patterns',
            subtitle : 'Short examples',
            dueCount : Math.max(1, total - Math.round(total * 0.77)),
            newCount : 0,
            reviewCount : Math.max(1, total - Math.round(total * 0.77)),
            tag : {kind : 'level', level : 'beyond_jlpt'}
        }
    ];
    const primary = samples[0];
    const primaryNewCount = primary.newCount ?? 0;

    switch (preset) {
        case 'none':
            return {decks : [], overflowDecks : 0};
        case 'one':
            return {
                decks : [
                    {
                        ...primary,
                        dueCount : total,
                        reviewCount : Math.max(0, total - primaryNewCount)
                    }
                ],
                overflowDecks : 0
            };
        case 'two':
            return {decks : samples.slice(0, 2), overflowDecks : 0};
        case 'three':
            return {decks : samples, overflowDecks : 0};
        case 'more':
            return {decks : samples, overflowDecks : 4};
    }
}

/**
 * Time-of-day Japanese greeting. Same four-bucket logic used on the login
 * page, kept inline here as a tiny helper rather than a shared module so the
 * dependency graph for Today stays self-contained. The brand-perfect choice
 * is the late-hour `おかえり` ("welcome back / welcome home") which carries
 * the family-of-the-desk feeling Tomo wants for someone studying late.
 */
function getJapaneseGreeting(hour: number): string {
    if (hour >= 5 && hour < 11) return 'おはよう';   // morning
    if (hour >= 11 && hour < 17) return 'こんにちは'; // afternoon
    if (hour >= 17 && hour < 22) return 'こんばんは'; // evening
    return 'おかえり';                                // late night and early hours
}

type GreetingTimeBucket = 'morning' | 'afternoon' | 'evening' | 'late'

function getGreetingBucket(hour: number): GreetingTimeBucket {
    if (hour >= 5 && hour < 11) return 'morning'
    if (hour >= 11 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 22) return 'evening'
    return 'late'
}

/**
 * Second clause of the welcome headline, varied by time-of-day so it pairs
 * with the Japanese eyebrow as a coherent couplet (JP and EN agree on when
 * the user arrived). Phrases are scene-grounded — coffee, the desk, the
 * lamp — not motivational. PRODUCT.md's anti-cheerleading rule applies
 * here as much as anywhere else on Today.
 */
function getEnglishWelcomeClause(bucket: GreetingTimeBucket): string {
    switch (bucket) {
        case 'morning':   return 'Pour the coffee.'
        case 'afternoon': return 'Pull up a chair.'
        case 'evening':   return 'The lamp is on.'
        case 'late':      return 'One or two is plenty.'
    }
}


function PageBackdrop(): React.JSX.Element {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none sticky top-0 z-0 -mb-[100vh] h-screen overflow-hidden"
        >
            <div aria-hidden="true" className="absolute inset-x-0 top-0 z-20 h-[2px] bg-inari-vermillion"/>
            <Image
                src="/assets/dashboard/hero-garden-background.png"
                alt=""
                aria-hidden="true"
                fill
                priority
                sizes="(min-width: 1024px) calc(100vw - 18rem), 100vw"
                className="object-cover opacity-[0.85] contrast-[1.15] brightness-[0.98]"
                style={{
                    objectPosition : '65% 50%',
                    WebkitMaskImage :
                        'linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)',
                    maskImage :
                        'linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)'
                }}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background : [
                        'linear-gradient(180deg, var(--color-cool-paper-base) 0%, transparent 14%, transparent 86%, var(--color-cool-paper-base) 100%)',
                        'linear-gradient(90deg, color-mix(in srgb, var(--color-cool-paper-base) 22%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--color-cool-paper-base) 22%, transparent) 100%)',
                        'linear-gradient(0deg, color-mix(in srgb, var(--color-inari-vermillion) 2%, transparent), color-mix(in srgb, var(--color-inari-vermillion) 2%, transparent))'
                    ].join(', ')
                }}
            />
        </div>
    );
}

// ── Greeting (lives inside the centered content column, above the hero) ──────

function GreetingHeader({
                            greetingName
                        }: {
    greetingName: string | null
}): React.JSX.Element {
    // Both the Japanese eyebrow and the English second clause are
    // browser-hour-derived, so they're hydration-only. We reserve their
    // vertical space ahead of mount so the headline doesn't reflow when
    // they fade in. The first clause ("Welcome back, {name}.") is the
    // SSR-stable wayfinder; the warm second clause arrives a beat later.
    const [hour, setHour] = useState<number | null>(null);
    const japaneseGreeting = hour !== null ? getJapaneseGreeting(hour) : null;
    const warmClause = hour !== null ? getEnglishWelcomeClause(getGreetingBucket(hour)) : null;
    useEffect(() => {
        setHour(new Date().getHours());
    }, []);

    const englishLead = greetingName !== null
        ? `Welcome back, ${greetingName}.`
        : 'Welcome back.';

    return (
        <header className="grid gap-y-3">
            <p
                lang="ja"
                aria-hidden={japaneseGreeting === null}
                className={[
                    'min-h-[1.6em] text-[1.0625rem] leading-relaxed text-faded-sumi',
                    'transition-opacity duration-500 ease-out motion-reduce:transition-none',
                    japaneseGreeting === null ? 'opacity-0' : 'opacity-100'
                ].join(' ')}
            >
                {japaneseGreeting !== null ? `${japaneseGreeting}。` : '　'}
            </p>

            <h1
                id="today-greeting"
                className="max-w-[48rem] font-display text-[1.65rem] font-medium leading-[1.12] text-sumi-ink text-balance sm:text-[1.95rem] lg:text-[2.25rem]"
            >
                {englishLead}{' '}
                <span
                    aria-hidden={warmClause === null}
                    className={[
                        'font-normal text-faded-sumi',
                        'transition-opacity duration-500 ease-out motion-reduce:transition-none',
                        warmClause === null ? 'opacity-0' : 'opacity-100'
                    ].join(' ')}
                >
                    {warmClause ?? ' '}
                </span>
            </h1>
        </header>
    );
}


// ── Exit links (quiet typographic row to Insights) ───────────────────────────

function ExitLinksRow(): React.JSX.Element {
    const links: ReadonlyArray<{href: string; label: string}> = [
        {href : '/insights/mistakes', label : 'Review weak spots'},
        {href : '/insights/progress', label : "See how you're trending"},
        {href : '/decks', label : 'Manage decks'}
    ];

    return (
        <nav aria-label="More on Tomo">
            <ul className="flex flex-col border-t border-soft-hairline sm:hidden">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            className={[
                                'flex min-h-11 items-center justify-between gap-3 border-b border-soft-hairline px-1 py-2.5',
                                'font-mono text-[0.75rem] uppercase tracking-[0.10em] text-sumi-ink/80',
                                'today-motion-colors',
                                'hover:text-inari-vermillion active:bg-cream-inset/60',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45'
                            ].join(' ')}
                        >
                            <span>{link.label}</span>
                            <span aria-hidden="true" className="font-mono text-base leading-none text-faded-sumi/70">
                                →
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>

            <ul className="hidden flex-wrap items-center gap-x-3 gap-y-1 sm:-ml-1 sm:flex">
                {links.map((link, index) => (
                    <li key={link.href} className="flex items-center gap-x-3">
                        {index > 0 && (
                            <span aria-hidden="true" className="font-mono text-xs text-faded-sumi/45">
                                ·
                            </span>
                        )}
                        <Link
                            href={link.href}
                            className={[
                                'inline-flex min-h-9 items-center px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi',
                                'today-motion-colors hover:text-inari-vermillion underline-offset-4 hover:underline',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-inari-vermillion/45'
                            ].join(' ')}
                        >
                            {link.label} →
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

/**
 * Today client. Composes: masthead → optional offline band → hero → week
 * rhythm strip → exit links. Detached from the previous 12-column module
 * grid per the redesign brief. Dev tools are now a free-floating draggable
 * panel via TodayDevToolsDock.
 */
export function DashboardClient({
                                    dateLabel,
                                    dateTime,
                                    greetingName,
                                    greetingPrefix,
                                    timeZone
                                }: TodayClientProps): React.JSX.Element {
    const router = useRouter();
    const [heroControls, setHeroControls] = useState<HeroDevControls>(DEFAULT_HERO_DEV_CONTROLS);
    const [moduleControls, setModuleControls] = useState<ModuleDevControls>(DEFAULT_MODULE_DEV_CONTROLS);
    const [devToolsOpen, setDevToolsOpen] = useState(false);
    const [calendar, setCalendar] = useState<DashboardCalendarContext>(() => ({
        dateLabel,
        dateTime,
        greetingPrefix,
        todayKey : dateTime,
        yesterdayKey : addDaysToDateKey(dateTime, -1),
        timeZone : normalizeDashboardTimeZone(timeZone)
    }));
    const previewActive = HERO_PREVIEW_ENABLED && devToolsOpen;

    useEffect(() => {
        function syncCalendar(): void {
            setCalendar((current) => {
                const next = buildDashboardCalendarContext(new Date(), timeZone);
                return dashboardCalendarContextMatches(current, next) ? current : next;
            });
        }

        syncCalendar();
        const intervalId = window.setInterval(syncCalendar, 60 * 1000);
        return () => window.clearInterval(intervalId);
    }, [timeZone]);


    useEffect(() => {
        if (!HERO_PREVIEW_ENABLED) return;

        function handleToggle(): void {
            setDevToolsOpen((open) => !open);
        }

        window.addEventListener(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT, handleToggle);
        return () => window.removeEventListener(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT, handleToggle);
    }, []);

    useEffect(() => {
        if (!devToolsOpen) return;

        function handleEscape(event: KeyboardEvent): void {
            if (event.key === 'Escape') setDevToolsOpen(false);
        }

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [devToolsOpen]);

    // ── Data sources ──────────────────────────────────────────────────────────
    const decksQuery = useDecks();
    const deckById = useMemo(() => {
        return new Map((decksQuery.data?.items ?? []).map((deck) => [deck.id, deck]));
    }, [decksQuery.data]);

    const dueQuery = useDueCards();

    // Resume detection. A `phase === 'active'` session in the Zustand store
    // takes precedence over every other hero variant, per IA.
    const resume = useResumeContext();

    // Power-user fast path. `R` or `Enter` from anywhere on Today starts a
    // review: resume the paused session when one exists, otherwise route to
    // setup. Suppressed when a modifier key is held or the user is typing in
    // a form control / contenteditable surface — those cases own the key.
    useEffect(() => {
        function handleKey(event: KeyboardEvent): void {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const key = event.key.toLowerCase();
            if (key !== 'r' && key !== 'enter') return;

            const target = event.target as HTMLElement | null;
            if (target !== null) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (target.isContentEditable) return;
            }

            event.preventDefault();
            router.push(resume !== null ? '/review/session' : '/review/setup');
        }

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [router, resume]);

    const liveHeroVariant = useMemo<DashboardHeroVariant>(() => {
        if (resume !== null) return {kind : 'resume', context : {remaining : resume.remaining}};
        if (dueQuery.isLoading || decksQuery.isLoading) return {kind : 'loading' as const};
        if (dueQuery.isError) return {kind : 'error' as const};

        const items = dueQuery.data?.items ?? [];
        if (items.length === 0) return {kind : 'caught-up' as const};

        return {
            kind : 'due' as const,
            queue : buildHeroQueueFromDueCards(items, calendar.todayKey, calendar.timeZone, deckById)
        };
    }, [
        calendar.todayKey,
        calendar.timeZone,
        deckById,
        decksQuery.isLoading,
        dueQuery.isLoading,
        dueQuery.isError,
        dueQuery.data,
        resume
    ]);
    const previewHeroVariant = useMemo(
        () => buildPreviewHeroVariant(heroControls),
        [heroControls]
    );
    const heroVariant = previewActive ? previewHeroVariant : liveHeroVariant;

    // ── Week rhythm strip ──────────────────────────────────────────────────────
    const forecastQuery = useReviewForecast();
    const liveWeekRhythmState: WeekRhythmState =
              forecastQuery.isLoading ? 'loading' :
                  forecastQuery.isError ? 'error' :
                      'default';

    const previewWeekRhythmState = moduleStateToWeekRhythmState(moduleControls.weekState);
    const weekRhythmState = previewActive ? previewWeekRhythmState : liveWeekRhythmState;

    const previewWeekRhythmDays = useMemo(
        () => buildPreviewForecastDays(moduleControls.weekPattern, calendar.todayKey),
        [moduleControls.weekPattern, calendar.todayKey]
    );
    const weekRhythmDays = previewActive
        ? previewWeekRhythmDays
        : (forecastQuery.data?.items ?? []);


    return (
        <div className="relative isolate flex flex-1 flex-col">
            <PageBackdrop/>

            <div className="relative z-10 grid flex-1 grid-cols-1 content-center gap-y-8 mx-auto w-full max-w-[1440px] px-6 pt-8 md:px-12 md:pt-10 lg:px-16 lg:pt-12">
                {previewActive && (
                    <TodayDevToolsDock
                        heroControls={heroControls}
                        moduleControls={moduleControls}
                        onHeroChange={setHeroControls}
                        onModuleChange={setModuleControls}
                        onClose={() => setDevToolsOpen(false)}
                    />
                )}

                <div className="grid grid-cols-1 gap-y-4">
                    <GreetingHeader greetingName={greetingName}/>

                    <OfflineStatusBand/>

                    <DashboardHero variant={heroVariant}/>
                </div>

                <div className="grid grid-cols-1 gap-y-4">
                    <WeekRhythmStrip
                        state={weekRhythmState}
                        todayKey={calendar.todayKey}
                        apiDays={weekRhythmDays}
                    />

                    <ExitLinksRow/>
                </div>
            </div>
        </div>
    );
}

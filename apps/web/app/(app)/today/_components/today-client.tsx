'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
    getEnglishWelcomeClause,
    getGreetingBucket,
    getJapaneseGreeting
} from '@/lib/japanese-greeting';
import { useDecks } from '@/lib/api/decks';
import { useDueCards, useReviewForecast } from '@/lib/api/reviews';
import { useTomoNoteQuery } from '@/lib/api/tomo';
import { useWeakSpotsQuery } from '@/lib/api/weak-spots';
import { useResumeContext } from '@/stores/useReviewSessionStore';
import { PageGate } from '@/components/ui/TomoLoader';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import { WEAK_SPOT_QUERY_LIMIT } from './today-hero';
import { QueueErrorPane } from '@/components/ui/QueueErrorPane';
import { TodayWeekRhythmSilhouette } from './today-error-pane';

import { useTodayDevState } from '@/dev/panels/today';

import { OfflineStatusBand } from './offline-status-band';
import {
    addDaysToDateKey,
    buildDashboardCalendarContext,
    normalizeDashboardTimeZone,
    type DashboardCalendarContext
} from './today-calendar';
import Link from 'next/link';
import { ArrowGlyph } from '@/components/icons/arrow-glyph';
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar';
import { buildHeroQueueFromDueCards } from './today-due-queue';
import {
    DashboardHero,
    getHeroCta,
    type DashboardHeroVariant,
    type HeroCta
} from './today-hero';
import { buildPreviewForecastDays, buildPreviewHeroVariant } from './today-preview-data';
import { WeekRhythmStrip, type WeekRhythmState } from './week-rhythm-strip';

// ── Constants ────────────────────────────────────────────────────────────────

const CALENDAR_TICK_MS = 60_000;

// ── Types ────────────────────────────────────────────────────────────────────

interface TodayClientProps {
    dateLabel: string;
    dateTime: string;
    greetingName: string | null;
    greetingPrefix: string;
    timeZone: string;
}

function calendarContextsEqual(
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

// ── Today client ─────────────────────────────────────────────────────────────

export function DashboardClient({
                                    dateLabel,
                                    dateTime,
                                    greetingName,
                                    greetingPrefix,
                                    timeZone
                                }: TodayClientProps): React.JSX.Element {
    const router = useRouter();
    const {hero : heroControls, modules : moduleControls, errors : errorControls, previewActive} = useTodayDevState();
    const [calendar, setCalendar] = useState<DashboardCalendarContext>(() => ({
        dateLabel,
        dateTime,
        greetingPrefix,
        todayKey : dateTime,
        yesterdayKey : addDaysToDateKey(dateTime, -1),
        timeZone : normalizeDashboardTimeZone(timeZone)
    }));

    // Tick the calendar context once a minute so date/greeting stay accurate
    // across midnight without a full page reload.
    useEffect(() => {
        function sync(): void {
            setCalendar((current) => {
                const next = buildDashboardCalendarContext(new Date(), timeZone);
                return calendarContextsEqual(current, next) ? current : next;
            });
        }

        sync();
        const id = window.setInterval(sync, CALENDAR_TICK_MS);
        return () => window.clearInterval(id);
    }, [timeZone]);

    // ── Live data sources ──────────────────────────────────────────────────────
    const decksQuery = useDecks();
    const dueQuery = useDueCards();
    const forecastQuery = useReviewForecast();
    const resume = useResumeContext();

    // Pre-review-note queries. Mirrored from HeroPreSessionNote so the page
    // gate can hold the screen until the right note (weak-spot peek, Tomo
    // note, or fallback) is ready to render. TanStack Query dedups by
    // queryKey, so HeroPreSessionNote's later calls hit the same cache and
    // return resolved data on first render — no placeholder flash.
    const weakSpotsQuery = useWeakSpotsQuery({
        status: 'unresolved',
        limit:  WEAK_SPOT_QUERY_LIMIT,
        sort:   'mostRecent',
    });
    const weakSpotsSettled = !weakSpotsQuery.isPending;
    const hasWeakSpots     = (weakSpotsQuery.data?.items ?? []).length > 0;
    // Mirror HeroPreSessionNote's enabled gate: AI quota only spent on calm
    // days. When not enabled, the tomoNote query stays pending forever
    // (TanStack semantics) — we must NOT wait for it in that case.
    const tomoNoteEnabled  = weakSpotsSettled && !hasWeakSpots;
    const tomoNoteQuery    = useTomoNoteQuery({
        dateKey: calendar.todayKey,
        enabled: tomoNoteEnabled,
    });

    const deckById = useMemo(
        () => new Map((decksQuery.data?.items ?? []).map((d) => [d.id, d])),
        [decksQuery.data]
    );

    // Power-user fast path: `R`/`Enter` anywhere on Today starts a review.
    // Suppressed when a modifier is held or focus is inside a form control —
    // those cases own the key.
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
            router.push('/review/session');
        }

        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [router, resume]);

    // ── Hero variant ───────────────────────────────────────────────────────────
    // Resume takes precedence over every other variant per IA. PageGate
    // guarantees decks/due/forecast have resolved before this renders, and
    // critical errors are handled by the page-level QueueErrorPane below,
    // so the hero never sees an error state.
    const liveHeroVariant = useMemo<DashboardHeroVariant>(() => {
        if (resume !== null) return {kind: 'resume', context: {remaining: resume.remaining}};

        const items = dueQuery.data?.items ?? [];
        if (items.length === 0) return {kind: 'caught-up'};

        return {
            kind:  'due',
            queue: buildHeroQueueFromDueCards(items, calendar.todayKey, calendar.timeZone, deckById)
        };
    }, [
        calendar.todayKey,
        calendar.timeZone,
        deckById,
        dueQuery.data,
        resume,
    ]);

    const previewHeroVariant = useMemo(() => buildPreviewHeroVariant(heroControls), [heroControls]);
    const heroVariant = previewActive ? previewHeroVariant : liveHeroVariant;

    // ── Week review strip ──────────────────────────────────────────────────────
    // Week rhythm strip only carries 'default' on today now; the strip's
    // own internal error state is unused here because forecast failures
    // are handled by the page-level silhouette below.
    const weekRhythmState: WeekRhythmState = 'default';

    // ── Critical error / partial failure routing ───────────────────────────────
    // Critical = "can we show today's queue?" If either due or decks errored,
    // the hero's primary purpose is broken, so the route enters the unified
    // error state. Resume still wins (a finished session can be picked up
    // even when fresh-data queries fail). Partial failure = only forecast
    // errored: the hero renders real data and the week strip falls back to
    // the silhouette below.
    //
    // Dev-panel "Today · Errors" can force either state for visual
    // inspection without staging a real failure.
    const queryClient    = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const criticalError  = errorControls.state === 'critical'
        || (
            !previewActive
            && resume === null
            && (dueQuery.isError || decksQuery.isError)
        );
    const forecastOnlyError = errorControls.state === 'forecast-only'
        || (
            !previewActive
            && !criticalError
            && forecastQuery.isError
        );

    async function handleRefresh(): Promise<void> {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() }),
            ]);
        } finally {
            setRefreshing(false);
        }
    }

    const previewWeekRhythmDays = useMemo(
        () => buildPreviewForecastDays(moduleControls.weekPattern, calendar.todayKey),
        [moduleControls.weekPattern, calendar.todayKey]
    );
    const weekRhythmDays = previewActive ? previewWeekRhythmDays : (forecastQuery.data?.items ?? []);

    // Page-level wait-then-reveal gate. Holds the content area until every
    // critical query has resolved (or errored). Preview mode opens the gate
    // immediately since no real data is in flight. Once open, the gate
    // latches so background refetches do not hide the page.
    //
    // Pre-review note queries are included so the right note (weak-spots,
    // Tomo note, or fallback line) is in place at first paint — no
    // placeholder flash inside the hero.
    const pageReady = previewActive
        || (
            !decksQuery.isPending
            && !dueQuery.isPending
            && !forecastQuery.isPending
            && !weakSpotsQuery.isPending
            && (!tomoNoteEnabled || !tomoNoteQuery.isPending)
        );

    return (
        <PageGate ready={pageReady}>
            <div className="relative isolate flex flex-1 flex-col">
                {criticalError ? (
                    <QueueErrorPane onRefresh={() => void handleRefresh()} refreshing={refreshing}/>
                ) : (
                    <>
                        <div className="relative z-10 grid flex-1 grid-cols-1 content-start lg:content-center gap-y-8 mx-auto w-full max-w-[1440px] px-4 pt-4 pb-30 md:px-12 md:pt-10 lg:px-16 lg:pt-12 lg:pb-12">
                            <div className="grid grid-cols-1 gap-y-4">
                                <GreetingHeader greetingName={greetingName}/>
                                <OfflineStatusBand/>
                                <DashboardHero variant={heroVariant} dateKey={calendar.todayKey}/>
                            </div>

                            {/* First-time learners have no decks yet, so the
                                forecast is structurally empty. Hiding the
                                week strip keeps the welcome focused on
                                picking a deck instead of staring at a flat
                                chart. */}
                            {heroVariant.kind !== 'first-time' && (
                                forecastOnlyError ? (
                                    <TodayWeekRhythmSilhouette/>
                                ) : (
                                    <WeekRhythmStrip state={weekRhythmState} todayKey={calendar.todayKey} apiDays={weekRhythmDays}/>
                                )
                            )}
                        </div>

                        {/* Mobile/tablet sticky CTA. Mirrors the hero's primary
                            action so the affordance is always above the fold on
                            phone-sized viewports, where the in-hero CTA slips
                            below the natural fold. Hidden at lg+. */}
                        <HeroStickyCta variant={heroVariant}/>
                    </>
                )}
            </div>
        </PageGate>
    );
}

// ── Mobile sticky CTA ────────────────────────────────────────────────────────

function HeroStickyCta({variant}: {variant: DashboardHeroVariant}): React.JSX.Element {
    const cta = getHeroCta(variant);
    return (
        <MobileStickyActionBar ariaLabel={`${cta.label} action`}>
            <HeroStickyCtaLink cta={cta}/>
        </MobileStickyActionBar>
    );
}

function HeroStickyCtaLink({cta}: {cta: HeroCta}): React.JSX.Element {
    // Palette mirrors <Button> primary/secondary variants per DESIGN.md:
    // base is the brand red, hover deepens. No transforms — DESIGN.md bans
    // scale/translate on buttons; press is felt as ink, not movement.
    const primaryClasses = [
        'bg-inari-vermillion text-warm-paper-raised',
        'hover:bg-inari-vermillion-deep',
        'active:bg-inari-vermillion-deep active:shadow-pressed',
    ].join(' ');
    const secondaryClasses = [
        'border border-soft-hairline bg-warm-paper-raised text-sumi-ink',
        'hover:border-faded-sumi hover:bg-cream-inset',
        'active:bg-soft-hairline',
    ].join(' ');

    return (
        <Link
            href={cta.href}
            className={[
                'inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xs px-6 py-3',
                'text-base font-semibold',
                'today-motion-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
                cta.tone === 'primary' ? primaryClasses : secondaryClasses,
            ].join(' ')}
        >
            {cta.label}
            <ArrowGlyph direction="right"/>
        </Link>
    );
}

// ── Greeting header ──────────────────────────────────────────────────────────

function GreetingHeader({greetingName}: {greetingName: string | null}): React.JSX.Element {
    // Japanese eyebrow and English second clause are derived from the browser
    // hour, so they're hydration-only. Reserve their vertical space ahead of
    // mount so the headline doesn't reflow when they fade in.
    const [hour, setHour] = useState<number | null>(null);
    useEffect(() => { setHour(new Date().getHours()); }, []);

    const japaneseGreeting = hour !== null ? getJapaneseGreeting(hour) : null;
    const warmClause = hour !== null ? getEnglishWelcomeClause(getGreetingBucket(hour)) : null;
    const englishLead = greetingName !== null ? `Welcome back, ${greetingName}.` : 'Welcome back.';

    return (
        <header className="grid gap-y-3">
            <p
                lang="ja"
                aria-hidden={japaneseGreeting === null}
                className={[
                    'min-h-[1.6em] text-md leading-relaxed text-faded-sumi',
                    'transition-opacity duration-500 ease-out motion-reduce:transition-none',
                    japaneseGreeting === null ? 'opacity-0' : 'opacity-100'
                ].join(' ')}
            >
                {japaneseGreeting !== null ? `${japaneseGreeting}。` : '　'}
            </p>

            <h1
                id="today-greeting"
                className="max-w-[48rem] font-display text-title font-medium text-sumi-ink text-balance"
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
          {warmClause ?? ' '}
        </span>
            </h1>
        </header>
    );
}


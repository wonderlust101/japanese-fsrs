"use client";

import { useCallback, useMemo, useState } from "react";

import { useDevPanel } from "@/dev";

import { cn } from "@/lib/utils";

// ── Public types ─────────────────────────────────────────────────────────────

export type HeroKindKey
	= | "due"
		| "caught-up"
		| "first-time"
		| "resume";

export type HeroQueuePreset = "one" | "no-backlog" | "typical" | "backlog-heavy" | "large";
export type HeroDeckPreset = "none" | "one" | "two" | "three" | "more";
export type HeroRouteMixPreset = "balanced" | "new-heavy" | "review-heavy";
export type HeroFlagPreset = "none" | "stale-data";

export interface HeroDevControls {
	variant: HeroKindKey;
	queue: HeroQueuePreset;
	decks: HeroDeckPreset;
	routeMix: HeroRouteMixPreset;
	flag: HeroFlagPreset;
}

export type WeekRhythmPattern
	= | "typical" | "caught-up" | "backlog-heavy" | "new-heavy"
		| "ramp-up" | "winding-down" | "busy-today";

export interface ModuleDevControls {
	weekPattern: WeekRhythmPattern;
}

/**
 * Page-level error preview. These previews force the new page-level error
 * UI (QueueErrorPane / TodayWeekRhythmSilhouette) regardless of live query
 * state, so the surface can be inspected without staging a real failure.
 *
 *   - 'none':           no override, page renders normally.
 *   - 'critical':       renders QueueErrorPane in place of the content column.
 *   - 'forecast-only':  hero renders preview/live data, week strip is replaced
 *                       by the inert silhouette.
 */
export type ErrorPreviewState = "none" | "critical" | "forecast-only";

export interface ErrorDevControls {
	state: ErrorPreviewState;
}

const DEFAULT_HERO: HeroDevControls = {
	variant: "due",
	queue: "typical",
	decks: "three",
	routeMix: "balanced",
	flag: "none",
};

const DEFAULT_MODULES: ModuleDevControls = {
	weekPattern: "typical",
};

const DEFAULT_ERRORS: ErrorDevControls = {
	state: "none",
};

export interface TodayDevState {
	hero: HeroDevControls;
	modules: ModuleDevControls;
	errors: ErrorDevControls;
	/**
	 * True whenever the engineer is forcing any non-default value. The page
	 *  reads this to decide whether to render preview data or live API data.
	 */
	previewActive: boolean;
}

// ── Public hook ──────────────────────────────────────────────────────────────

/**
 * Registers the two Today dev panels (Hero variant + Week ahead) with the
 * global dev dock and exposes the current control values to the page.
 *
 * Production: useDevPanel is a no-op so nothing registers and `previewActive`
 * stays false. The page renders live data and never reaches the preview
 * branches.
 */
export function useTodayDevState(): TodayDevState {
	const [hero, setHero] = useState<HeroDevControls>(DEFAULT_HERO);
	const [modules, setModules] = useState<ModuleDevControls>(DEFAULT_MODULES);
	const [errors, setErrors] = useState<ErrorDevControls>(DEFAULT_ERRORS);

	const previewActive
		= hero.variant !== DEFAULT_HERO.variant
			|| hero.queue !== DEFAULT_HERO.queue
			|| hero.decks !== DEFAULT_HERO.decks
			|| hero.routeMix !== DEFAULT_HERO.routeMix
			|| hero.flag !== DEFAULT_HERO.flag
			|| modules.weekPattern !== DEFAULT_MODULES.weekPattern
			|| errors.state !== DEFAULT_ERRORS.state;

	const heroSummary = useMemo(() => {
		if (hero.variant !== DEFAULT_HERO.variant)
			return labelForHeroVariant(hero.variant);
		return "Live";
	}, [hero.variant]);

	const renderHero = useCallback(() => (
		<HeroControlsBody controls={hero} onChange={setHero} />
	), [hero]);

	const renderModules = useCallback(() => (
		<ModuleControlsBody controls={modules} onChange={setModules} />
	), [modules]);

	const renderErrors = useCallback(() => (
		<ErrorControlsBody controls={errors} onChange={setErrors} />
	), [errors]);

	useDevPanel({
		id: "today.hero",
		title: "Today · Hero",
		render: renderHero,
		activeLabel: heroSummary,
	});

	useDevPanel({
		id: "today.modules",
		title: "Today · Week ahead",
		render: renderModules,
		activeLabel: labelForPattern(modules.weekPattern),
	});

	useDevPanel({
		id: "today.errors",
		title: "Today · Errors",
		render: renderErrors,
		activeLabel: errors.state === "none" ? "Off" : labelForErrorState(errors.state),
	});

	return { hero, modules, errors, previewActive };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function labelForHeroVariant(v: HeroKindKey): string {
	switch (v) {
		case "due": return "Due";
		case "caught-up": return "Caught up";
		case "first-time": return "First time";
		case "resume": return "Resume";
	}
}

function labelForPattern(p: WeekRhythmPattern): string {
	switch (p) {
		case "typical": return "Typical";
		case "caught-up": return "Caught up";
		case "backlog-heavy": return "Backlog heavy";
		case "new-heavy": return "New heavy";
		case "ramp-up": return "Ramping up";
		case "winding-down": return "Winding down";
		case "busy-today": return "Busy today";
	}
}

function labelForErrorState(s: ErrorPreviewState): string {
	switch (s) {
		case "none": return "Off";
		case "critical": return "Page error";
		case "forecast-only": return "Week silhouette";
	}
}

// ── Body — hero controls ─────────────────────────────────────────────────────

const VARIANT_OPTIONS: Array<{ value: HeroKindKey; label: string }> = [
	{ value: "due", label: "Due" },
	{ value: "caught-up", label: "Caught up" },
	{ value: "first-time", label: "First time" },
	{ value: "resume", label: "Resume" },
];

const QUEUE_OPTIONS: Array<{ value: HeroQueuePreset; label: string }> = [
	{ value: "one", label: "1 card" },
	{ value: "no-backlog", label: "No backlog" },
	{ value: "typical", label: "Typical" },
	{ value: "backlog-heavy", label: "Backlog heavy" },
	{ value: "large", label: "Large" },
];

const DECK_OPTIONS: Array<{ value: HeroDeckPreset; label: string }> = [
	{ value: "none", label: "No decks" },
	{ value: "one", label: "1 deck" },
	{ value: "two", label: "2 decks" },
	{ value: "three", label: "3 decks" },
	{ value: "more", label: "3 + more" },
];

const ROUTE_MIX_OPTIONS: Array<{ value: HeroRouteMixPreset; label: string }> = [
	{ value: "balanced", label: "Balanced" },
	{ value: "new-heavy", label: "New heavy" },
	{ value: "review-heavy", label: "Review heavy" },
];

const FLAG_OPTIONS: Array<{ value: HeroFlagPreset; label: string }> = [
	{ value: "none", label: "No flag" },
	{ value: "stale-data", label: "Stale data" },
];

function HeroControlsBody({
	controls,
	onChange,
}: {
	controls: HeroDevControls;
	onChange: (next: HeroDevControls) => void;
}): React.JSX.Element {
	function update<K extends keyof HeroDevControls>(key: K, value: HeroDevControls[K]): void {
		onChange({ ...controls, [key]: value });
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			<DockSelect label="State" value={controls.variant} options={VARIANT_OPTIONS} onChange={v => update("variant", v as HeroKindKey)} />
			<DockSelect label="Queue" value={controls.queue} options={QUEUE_OPTIONS} onChange={v => update("queue", v as HeroQueuePreset)} />
			<DockSelect label="Decks" value={controls.decks} options={DECK_OPTIONS} onChange={v => update("decks", v as HeroDeckPreset)} />
			<DockSelect label="Route mix" value={controls.routeMix} options={ROUTE_MIX_OPTIONS} onChange={v => update("routeMix", v as HeroRouteMixPreset)} />
			<div className="col-span-2">
				<DockSelect label="Flag" value={controls.flag} options={FLAG_OPTIONS} onChange={v => update("flag", v as HeroFlagPreset)} />
			</div>
		</div>
	);
}

// ── Body — module controls ───────────────────────────────────────────────────

const WEEK_PATTERN_OPTIONS: Array<{ value: WeekRhythmPattern; label: string }> = [
	{ value: "typical", label: "Typical mix" },
	{ value: "busy-today", label: "Busy today" },
	{ value: "backlog-heavy", label: "Backlog heavy" },
	{ value: "new-heavy", label: "New heavy" },
	{ value: "ramp-up", label: "Ramping up" },
	{ value: "winding-down", label: "Winding down" },
	{ value: "caught-up", label: "Caught up week" },
];

function ModuleControlsBody({
	controls,
	onChange,
}: {
	controls: ModuleDevControls;
	onChange: (next: ModuleDevControls) => void;
}): React.JSX.Element {
	function update<K extends keyof ModuleDevControls>(key: K, value: ModuleDevControls[K]): void {
		onChange({ ...controls, [key]: value });
	}

	return (
		<div className="grid grid-cols-1 gap-2">
			<DockSelect label="Pattern" value={controls.weekPattern} options={WEEK_PATTERN_OPTIONS} onChange={v => update("weekPattern", v as WeekRhythmPattern)} />
		</div>
	);
}

// ── Body — error controls ────────────────────────────────────────────────────
// Page-level error preview: forces QueueErrorPane (critical) or
// TodayWeekRhythmSilhouette (forecast-only) without staging a real failure.

const ERROR_STATE_OPTIONS: Array<{ value: ErrorPreviewState; label: string }> = [
	{ value: "none", label: "Off" },
	{ value: "critical", label: "Page error" },
	{ value: "forecast-only", label: "Week silhouette" },
];

function ErrorControlsBody({
	controls,
	onChange,
}: {
	controls: ErrorDevControls;
	onChange: (next: ErrorDevControls) => void;
}): React.JSX.Element {
	return (
		<div className="grid grid-cols-1 gap-2">
			<DockSelect
				label="State"
				value={controls.state}
				options={ERROR_STATE_OPTIONS}
				onChange={v => onChange({ state: v as ErrorPreviewState })}
			/>
		</div>
	);
}

// ── Shared select primitive ──────────────────────────────────────────────────

export function DockSelect<T extends string>({
	label,
	value,
	options,
	onChange,
	disabled,
}: {
	label: string;
	value: T;
	options: ReadonlyArray<{ value: T; label: string }>;
	onChange: (next: T) => void;
	disabled?: boolean;
}): React.JSX.Element {
	return (
		<label className="block">
			<span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
				{label}
			</span>
			<select
				value={value}
				onChange={event => onChange(event.target.value as T)}
				disabled={disabled === true}
				className={cn(
					"mt-1 h-8 w-full rounded-[2px] border border-warm-paper-raised/15",
					"bg-warm-paper-raised/10 px-2 text-[0.75rem] text-warm-paper-raised",
					"transition-colors duration-150 ease-out outline-none",
					"hover:border-warm-paper-raised/35",
					"focus-visible:border-warm-paper-raised focus-visible:ring-1 focus-visible:ring-warm-paper-raised/20",
					"disabled:cursor-not-allowed disabled:opacity-50",
				)}
			>
				{options.map(option => (
					<option key={option.value} value={option.value} className="bg-sumi-ink text-warm-paper-raised">
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}

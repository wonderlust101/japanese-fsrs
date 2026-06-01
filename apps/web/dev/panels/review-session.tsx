"use client";

import type { FixtureKind } from "@/app/(app)/review/session/_components/session-fixtures";

import type { FuriganaMode } from "@/stores/useSessionPreferencesStore";
import { useCallback } from "react";

import {
	fixtureQueueOf,
	SESSION_FIXTURES,

} from "@/app/(app)/review/session/_components/session-fixtures";
import {
	SUMMARY_FIXTURE_KEYS,
	summaryFixtureLabel,
} from "@/app/(app)/review/summary/_components/summary-fixtures";
import { useDevPanel } from "@/dev/useDevStatePanel";

import { useReviewSessionStore } from "@/stores/useReviewSessionStore";
import {
	useSessionDevOverrides,
	useSessionDevOverridesActions,
} from "@/stores/useSessionDevOverridesStore";
import {
	useSessionPreferences,
	useSessionPreferencesActions,

} from "@/stores/useSessionPreferencesStore";

const KIND_OPTIONS: Array<{ value: FixtureKind; label: string }> = [
	{ value: "comprehension", label: "Comprehension" },
];

const BOOLEAN_OVERRIDES: Array<{
	key: keyof ReturnType<typeof useSessionDevOverrides>;
	label: string;
	hint: string;
}> = [
	{ key: "forceShowAnswer", label: "Reveal answer", hint: "Show the back of the card inside the SectionCard." },
	{ key: "prefersReducedMotion", label: "Reduced motion", hint: "Collapse the three-stage reveal stagger to instant." },
	{ key: "forceOffline", label: "Offline pill", hint: "Render the offline pill in the SectionCard header right-slot." },
	{ key: "forceSyncError", label: "Sync-error pill", hint: "Render the saved-locally pill in the SectionCard header right-slot." },
	{ key: "forceBootstrapFailed", label: "Bootstrap failed", hint: "Switch the surface to the error-stripe StateCard (Couldn’t load)." },
	{ key: "forceBootstrapping", label: "Bootstrap loader", hint: "Pin the brushy “Preparing your reviews” PageLoader." },
	{ key: "forceEndingSession", label: "Wrap-up loader", hint: "Pin the “Wrapping up” PageLoader (end-of-session transition)." },
];

const FURIGANA_OPTIONS: Array<{ value: FuriganaMode; label: string }> = [
	{ value: "hover", label: "Hover" },
	{ value: "always", label: "Always" },
	{ value: "off", label: "Off" },
];

/**
 * Register the rich Review Session control panel. Returns nothing — all
 * state lives in Zustand stores the panel manipulates directly.
 */
export function useReviewSessionDevState(): void {
	// Build-time gate: the body (and its session/summary fixture imports) is
	// referenced only in development, so production DCE drops it from the chunk.
	const render = useCallback(() => (process.env.NODE_ENV === "development" ? <SessionDevBody /> : null), []);

	useDevPanel({
		id: "review.session",
		title: "Review · Session",
		render,
	});
}

// ── Body ────────────────────────────────────────────────────────────────────

function SessionDevBody(): React.JSX.Element {
	const overrides = useSessionDevOverrides();
	const devActions = useSessionDevOverridesActions();
	const prefs = useSessionPreferences();
	const prefsActions = useSessionPreferencesActions();

	function seedFixture(kind: FixtureKind, fixtureId: string): void {
		const fx = SESSION_FIXTURES[kind].find(f => f.card.id === fixtureId);
		if (fx === undefined)
			return;
		useReviewSessionStore.getState().actions.startSession([fx.card]);
		devActions.set("forceShowAnswer", false);
	}

	function seedFullQueue(kind: FixtureKind): void {
		useReviewSessionStore.getState().actions.startSession(fixtureQueueOf(kind));
		devActions.set("forceShowAnswer", false);
	}

	function seedEveryFixture(): void {
		const all = [...SESSION_FIXTURES.comprehension];
		useReviewSessionStore.getState().actions.startSession(all.map(f => f.card));
		devActions.set("forceShowAnswer", false);
	}

	function resetSession(): void {
		useReviewSessionStore.getState().actions.reset();
		devActions.reset();
	}

	return (
		<div className="flex flex-col gap-3">
			<Section title="v4 state matrix">
				<p className="text-[0.65rem] text-warm-paper-raised/60 leading-snug">
					Top bar (page-scope) + centered SectionCard (omitTitle) + fixed bottom rating bar. Stripe tones:
					{" "}
					<span className="text-warm-paper-raised">brand</span>
					{" "}
					for live ·
					<span className="text-warm-paper-raised">aizome</span>
					{" "}
					for empty ·
					<span className="text-warm-paper-raised">error</span>
					{" "}
					for bootstrap-failed.
				</p>
			</Section>

			<Section title="Fixture queues">
				<div className="grid grid-cols-1 gap-2">
					{KIND_OPTIONS.map(opt => (
						<button
							key={opt.value}
							type="button"
							onClick={() => seedFullQueue(opt.value)}
							className="rounded-[2px] border border-warm-paper-raised/20 bg-warm-paper-raised/10 px-2 py-1.5 text-[0.7rem] text-warm-paper-raised hover:bg-warm-paper-raised/20 cursor-pointer"
						>
							{opt.label}
							<span className="block font-mono text-[0.6rem] tracking-wider text-warm-paper-raised/60">
								·
								{" "}
								{SESSION_FIXTURES[opt.value].length}
							</span>
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={seedEveryFixture}
					className="mt-2 w-full rounded-[2px] border border-warm-paper-raised/25 bg-warm-paper-raised/15 px-2 py-1.5 text-[0.7rem] text-warm-paper-raised hover:bg-warm-paper-raised/25 cursor-pointer"
				>
					Seed every fixture (sequential)
				</button>
			</Section>

			<Section title="Single-card fixtures">
				<div className="space-y-2">
					{KIND_OPTIONS.map(opt => (
						<details key={opt.value} className="group" open={opt.value === "comprehension"}>
							<summary className="cursor-pointer text-[0.7rem] uppercase tracking-[0.14em] text-warm-paper-raised/70 hover:text-warm-paper-raised font-mono">
								{opt.label}
							</summary>
							<div className="mt-1 grid grid-cols-1 gap-1">
								{SESSION_FIXTURES[opt.value].map(fx => (
									<button
										key={fx.card.id}
										type="button"
										onClick={() => seedFixture(opt.value, fx.card.id)}
										className="text-left text-[0.7rem] text-warm-paper-raised/85 hover:text-warm-paper-raised hover:bg-warm-paper-raised/8 py-1 px-1 rounded-[1px] cursor-pointer"
										title={fx.note}
									>
										{fx.label}
										{fx.note !== undefined && (
											<span className="block text-[0.625rem] text-warm-paper-raised/45">{fx.note}</span>
										)}
									</button>
								))}
							</div>
						</details>
					))}
				</div>
			</Section>

			<Section title="Force visual states">
				<div className="grid grid-cols-1 gap-1.5">
					{BOOLEAN_OVERRIDES.map(opt => (
						<label
							key={opt.key}
							className="flex items-start gap-2 text-[0.7rem] leading-snug text-warm-paper-raised/85 cursor-pointer hover:text-warm-paper-raised"
							title={opt.hint}
						>
							<input
								type="checkbox"
								checked={overrides[opt.key] as boolean}
								onChange={e => devActions.set(opt.key, e.target.checked)}
								className="mt-[0.18rem] accent-warm-paper-raised cursor-pointer"
							/>
							<span>
								{opt.label}
								<span className="block text-[0.625rem] text-warm-paper-raised/45">{opt.hint}</span>
							</span>
						</label>
					))}
				</div>
			</Section>

			<Section title="Learner preferences">
				<label className="flex items-start gap-2 text-[0.7rem] leading-snug text-warm-paper-raised/85 cursor-pointer hover:text-warm-paper-raised">
					<input
						type="checkbox"
						checked={prefs.audioMuted}
						onChange={e => prefsActions.setAudioMuted(e.target.checked)}
						className="mt-[0.18rem] accent-warm-paper-raised cursor-pointer"
					/>
					<span>
						Mute audio
						<span className="block text-[0.625rem] text-warm-paper-raised/45">
							Disables autoplay on word and sentence audio.
						</span>
					</span>
				</label>

				<label className="mt-1.5 flex items-start gap-2 text-[0.7rem] leading-snug text-warm-paper-raised/85 cursor-pointer hover:text-warm-paper-raised">
					<input
						type="checkbox"
						checked={prefs.autoRevealTranslation}
						onChange={e => prefsActions.setAutoRevealTranslation(e.target.checked)}
						className="mt-[0.18rem] accent-warm-paper-raised cursor-pointer"
					/>
					<span>
						Auto-reveal translation
						<span className="block text-[0.625rem] text-warm-paper-raised/45">
							Skip the blur-to-reveal step on the back-of-card sentence translation.
						</span>
					</span>
				</label>

				<div className="mt-2 flex items-center gap-2 text-[0.7rem] text-warm-paper-raised/85">
					<span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-warm-paper-raised/55">
						Furigana
					</span>
					<div className="flex gap-1">
						{FURIGANA_OPTIONS.map(opt => (
							<button
								key={opt.value}
								type="button"
								onClick={() => prefsActions.setFuriganaMode(opt.value)}
								className={[
									"rounded-[2px] border px-1.5 py-0.5 text-[0.65rem] cursor-pointer",
									prefs.furiganaMode === opt.value
										? "bg-warm-paper-raised/25 border-warm-paper-raised/40 text-warm-paper-raised"
										: "border-warm-paper-raised/15 bg-warm-paper-raised/5 text-warm-paper-raised/70 hover:text-warm-paper-raised",
								].join(" ")}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
			</Section>

			<Section title="Summary states">
				<p className="text-[0.625rem] leading-snug text-warm-paper-raised/55 mb-1.5">
					Opens the Review Summary with fixture data for the named pattern. Dev-only; production strips the `?fixture` route.
				</p>
				<div className="grid grid-cols-2 gap-1.5">
					{SUMMARY_FIXTURE_KEYS.map(key => (
						<a
							key={key}
							href={`/review/summary/_fixture?fixture=${key}`}
							className="rounded-[2px] border border-warm-paper-raised/20 bg-warm-paper-raised/10 px-2 py-1.5 text-[0.65rem] text-warm-paper-raised hover:bg-warm-paper-raised/20 cursor-pointer text-center"
						>
							{summaryFixtureLabel(key)}
						</a>
					))}
				</div>
			</Section>

			<Section title="Session">
				<div className="flex gap-2">
					<button
						type="button"
						onClick={resetSession}
						className="rounded-[2px] border border-warm-paper-raised/20 bg-warm-paper-raised/10 px-2 py-1 text-[0.7rem] text-warm-paper-raised hover:bg-warm-paper-raised/20 cursor-pointer"
					>
						Reset queue
					</button>
					<button
						type="button"
						onClick={() => devActions.reset()}
						className="rounded-[2px] border border-warm-paper-raised/20 bg-warm-paper-raised/10 px-2 py-1 text-[0.7rem] text-warm-paper-raised hover:bg-warm-paper-raised/20 cursor-pointer"
					>
						Reset overrides
					</button>
				</div>
			</Section>
		</div>
	);
}

function Section({
	title,
	children,
}: { title: string; children: React.ReactNode }): React.JSX.Element {
	return (
		<section>
			<p className="mb-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-warm-paper-raised/55">
				{title}
			</p>
			{children}
		</section>
	);
}

"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Fragment, useRef, useState } from "react";

import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { ForgettingCurve } from "@/components/srs/ForgettingCurve";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FuriganaText } from "@/components/ui/FuriganaText";
import { Logo } from "@/components/ui/Logo";
import { SectionKicker } from "@/components/ui/SectionKicker";
import { cn } from "@/lib/utils";

import { InkShaderCanvas } from "./ink-shader-canvas";
import { WhyTomo } from "./why-tomo";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Inner measure for the talky bands (why / coverage). The hero and
// the continuous-take stage deliberately break out of this to go edge-to-edge.
const INNER = "mx-auto w-full max-w-6xl px-6 sm:px-8";

// Expo ease-out — the project's "weighted exhale" curve (globals.css
// --ease-out-expo). Mirrored here so GSAP tweens settle with the same
// calligraphic cadence as the CSS keyframes elsewhere in the app.
const EXPO_OUT = "expo.out";

// The headline, pre-split into words. Splitting in markup (not via SplitText)
// keeps it server-rendered and screen-reader-continuous: each word is an
// inline-block span, so assistive tech still reads one sentence.
const HEADLINE_WORDS = ["Your", "patient", "practice", "partner", "for", "Japanese."];

// The JLPT coverage ladder shown in the decks band. Colours are the design
// system's canonical level identities (globals.css --color-jlpt-*-text); used
// as small markers, not fills, so the band stays as calm as the rest of the
// page. Descriptors characterise each level rather than claiming per-level card
// counts (only the audited 7,370 total is asserted as a number).
const JLPT_LEVELS = [
	{ code: "N5", desc: "First steps: kana and core vocabulary", varName: "--color-jlpt-n5-text" },
	{ code: "N4", desc: "Everyday basics", varName: "--color-jlpt-n4-text" },
	{ code: "N3", desc: "The bridge to fluency", varName: "--color-jlpt-n3-text" },
	{ code: "N2", desc: "Comfortable with real material", varName: "--color-jlpt-n2-text" },
	{ code: "N1", desc: "Advanced and academic", varName: "--color-jlpt-n1-text" },
	{ code: "Beyond", desc: "Native, literary, domain-specific", varName: "--color-jlpt-beyond-text" },
] as const;

// ── The continuous take ──────────────────────────────────────────────────────
// Identical framing on every face is what sells the "one card" illusion: each
// act's media sits in the same right-hand slot with the same vermillion stripe,
// hairline, and warm-paper body, so cross-fading between them reads as a single
// card whose content morphs rather than four separate cards.
function Face({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
	return (
		<div
			className={cn(
				"relative w-full max-w-md rounded-xs border border-soft-hairline bg-warm-paper-raised px-6 pb-6 pt-7",
				className,
			)}
		>
			<span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 rounded-t-[2px] bg-inari-vermillion" />
			{children}
		</div>
	);
}

interface Act {
	id?: string;
	kicker: string;
	title: string;
	body: string;
	/** Decorative full-bleed kanji ghosted behind the act, always aria-hidden. */
	kanji: string;
	/** Surface tint for the act's full-bleed world. */
	surface: string;
	/** The card face that morphs into view for this beat. */
	face: React.ReactNode;
	/**
	 * When true, the incoming face flips on the Y axis (the mnemonic "turn the
	 *  card over" beat) instead of the default lift-and-fade.
	 */
	flip?: boolean;
}

const ACTS: readonly Act[] = [
	{
		// #features now lives on the take wrapper (works on both breakpoints), so
		// the desktop act no longer carries the id.
		kicker: "Cards built for you",
		title: "Type a word. Get a whole card.",
		body: "Reading, meaning, a natural example sentence, and a memory hook arrive together, ready to study. Every part is yours to edit, so the card ends up the way you’d have written it with an hour to spare.",
		kanji: "札",
		surface: "bg-cool-paper-base",
		face: (
			<Face>
				<span className="self-start rounded-full bg-cream-inset px-2.5 py-0.5 text-xs font-medium text-faded-sumi">
					Generated for you
				</span>
				<div className="mt-4">
					<FuriganaText text="練習" reading="れんしゅう" className="font-japanese text-5xl font-medium text-sumi-ink" />
					<p data-gen-line className="mt-3 text-base text-faded-sumi">practice; training</p>
				</div>
				<div data-gen-line className="mt-4 rounded-xs bg-cream-inset px-4 py-3">
					<p lang="ja" className="font-japanese text-base leading-relaxed text-sumi-ink">
						毎日
						<FuriganaText text="練習" reading="れんしゅう" />
						する。
					</p>
					<p className="mt-1 text-sm text-faded-sumi">I practice every day.</p>
				</div>
				<p data-gen-line className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">
					reading · meaning · example · hook
				</p>
			</Face>
		),
	},
	{
		kicker: "Sentences that fit you",
		title: "Words you’ll actually meet.",
		body: "Example sentences are written around what you care about, so a word lands in a scene you recognize instead of a textbook line you’ll never say. Furigana is there the moment you want it.",
		kanji: "文",
		surface: "bg-warm-paper-base",
		face: (
			<Face>
				<span className="self-start rounded-full bg-cream-inset px-2.5 py-0.5 text-xs font-medium text-faded-sumi">
					interest · coffee
				</span>
				<p lang="ja" className="mt-5 font-japanese text-3xl leading-relaxed text-sumi-ink">
					<FuriganaText text="毎朝" reading="まいあさ" />
					コーヒーを
					<FuriganaText text="飲" reading="の" />
					みます。
				</p>
				<p className="mt-4 text-lg italic text-faded-sumi">I drink coffee every morning.</p>
				<p className="mt-4 border-t border-soft-hairline pt-3 font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">
					Written around you
				</p>
			</Face>
		),
	},
	{
		kicker: "Hooks that stick",
		title: "A reason to remember.",
		body: "For the words that won’t stay put, Tomo writes a small, vivid mnemonic. Not a gimmick: a plain, memorable image that ties the shape and the sound to the meaning.",
		kanji: "憶",
		surface: "bg-cool-paper-base",
		flip: true,
		face: (
			<Face>
				<FuriganaText text="友" reading="とも" className="font-japanese text-6xl font-medium text-sumi-ink" />
				<p className="mt-2 text-base text-faded-sumi">friend</p>
				<p className="mt-4 text-base leading-[1.6] text-sumi-ink">
					Two people leaning the same way, shoulder over shoulder. A hand reaching back for another:
					that’s a
					{" "}
					<span lang="ja" className="font-japanese">友</span>
					, a friend who walks with you.
				</p>
				<span className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">
					Memory hook
				</span>
			</Face>
		),
	},
	{
		id: "method",
		kicker: "The schedule",
		title: "Timed to the edge of forgetting.",
		body: "Without review, recall drops away fast. Tomo returns each card just before it slips, so a few focused minutes each morning hold a surprising amount of Japanese in place.",
		kanji: "忘",
		surface: "bg-cool-paper-shade",
		face: (
			<Face className="max-w-xl">
				<div data-curve>
					<ForgettingCurve className="w-full" />
				</div>
			</Face>
		),
	},
] as const;

/**
 * The cinematic centerpiece: a single review card travels through four beats,
 * its content morphing while the world (surface tint + ghosted kanji + copy)
 * changes around it. On desktop with motion allowed, the stage PINS and a
 * scrubbed master timeline cross-fades act → act, scrubbed by the scroll wheel.
 * On tablet/phone or under reduced-motion the same markup renders as four plain
 * stacked bands, fully readable, no pin.
 */
function ContinuousTake({ trackRef }: { trackRef: React.RefObject<HTMLDivElement | null> }): React.JSX.Element {
	return (
		<div ref={trackRef} data-take-track className="relative hidden w-full lg:block">
			{ACTS.map((act, i) => (
				<section
					key={act.kicker}
					id={act.id}
					data-act
					data-act-index={i}
					data-act-flip={act.flip ? "1" : "0"}
					aria-label={act.title}
					className={cn("relative w-full overflow-hidden py-24 md:py-32", act.surface)}
				>
					<span
						data-act-kanji
						aria-hidden="true"
						lang="ja"
						className="pointer-events-none absolute right-[10%] top-1/2 z-0 -translate-y-1/2 select-none font-japanese leading-none text-sumi-ink/[0.05] text-[44vw] lg:text-[28rem]"
					>
						{act.kanji}
					</span>

					<div className="relative z-10 mx-auto grid h-full w-full max-w-6xl items-center gap-12 px-6 sm:px-8 lg:grid-cols-2 lg:place-content-center lg:gap-16">
						<div data-act-copy className="flex flex-col gap-4">
							<SectionKicker>{act.kicker}</SectionKicker>
							<h2 className="max-w-[18ch] font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-sumi-ink md:text-4xl lg:text-5xl">
								{act.title}
							</h2>
							<p className="max-w-measure text-base leading-[1.6] text-faded-sumi md:text-md">{act.body}</p>
						</div>
						<div data-act-face className="flex justify-center lg:justify-end">
							{act.face}
						</div>
					</div>
				</section>
			))}

			{/* Step indicator: makes the morph read as one card moving through beats,
          not separate slides. Driven by the pin's scroll progress; decorative
          (the act sections carry the announced content). */}
			<div
				data-take-step
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex items-center justify-center gap-3 motion-reduce:hidden"
			>
				<div className="flex items-center gap-2">
					{ACTS.map(act => (
						<span key={act.kicker} data-step-dot className="size-1.5 rounded-full bg-sumi-ink/25 transition-all duration-300" />
					))}
				</div>
				<span data-step-count className="font-mono text-xs tabular-nums text-faded-sumi">
					1 of
					{" "}
					{ACTS.length}
				</span>
			</div>
		</div>
	);
}

// ── Mobile fallback ──────────────────────────────────────────────────────────

/**
 * Mobile counterpart to the pinned desktop take: a tap-through where one
 * persistent card morphs through the same four beats. Built from the shared
 * `ACTS`, so copy and faces never drift from the desktop version. The dot row +
 * "N of 4" counter double as the "one card, many stages" cue. Renders below the
 * `lg` breakpoint only; the desktop `ContinuousTake` is `hidden lg:block`.
 */
function MobileTake(): React.JSX.Element {
	const [current, setCurrent] = useState(0);
	const total = ACTS.length;
	const act = ACTS[current];
	if (!act)
		return <></>;

	return (
		<section aria-label="How Tomo builds and schedules your cards" className="bg-cool-paper-base py-20 lg:hidden">
			<div className="mx-auto w-full max-w-md px-6">
				{/* Copy swaps with the active beat; aria-live announces the change. */}
				<div aria-live="polite" className="flex flex-col gap-3">
					<SectionKicker>{act.kicker}</SectionKicker>
					<h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-sumi-ink">
						{act.title}
					</h2>
					<p className="text-base leading-[1.6] text-faded-sumi">{act.body}</p>
				</div>

				{/* Card stage: every face shares one grid cell so the stage is sized to
            the tallest beat (no height jump). Only the active face is visible
            and in the a11y tree; the rest fade out and are aria-hidden. */}
				<div className="mt-7 grid">
					{ACTS.map((a, i) => (
						<div
							key={a.kicker}
							aria-hidden={i !== current}
							className={cn(
								"col-start-1 row-start-1 flex justify-center transition-opacity duration-500 motion-reduce:transition-none",
								i === current ? "opacity-100" : "pointer-events-none opacity-0",
							)}
						>
							{a.face}
						</div>
					))}
				</div>

				{/* Controls: prev / (dots + counter) / next. Chevrons are the 44px tap
            targets; dots + "N of 4" are the indicator. */}
				<div className="mt-8 flex items-center justify-between">
					<button
						type="button"
						aria-label="Previous capability"
						disabled={current === 0}
						onClick={() => setCurrent(c => Math.max(0, c - 1))}
						className="inline-flex size-11 items-center justify-center rounded-xs border border-soft-hairline text-sumi-ink transition-colors hover:bg-cream-inset disabled:opacity-35 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
					>
						<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
							<path d="M11 4 L6 9 L11 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>

					<div aria-hidden="true" className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							{ACTS.map((a, i) => (
								<span
									key={a.kicker}
									className={cn(
										"size-1.5 rounded-full transition-all duration-300",
										i === current ? "scale-150 bg-inari-vermillion" : "bg-sumi-ink/25",
									)}
								/>
							))}
						</div>
						<span className="font-mono text-xs tabular-nums text-faded-sumi">
							{current + 1}
							{" "}
							of
							{total}
						</span>
					</div>

					<button
						type="button"
						aria-label="Next capability"
						disabled={current === total - 1}
						onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
						className="inline-flex size-11 items-center justify-center rounded-xs border border-soft-hairline text-sumi-ink transition-colors hover:bg-cream-inset disabled:opacity-35 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
					>
						<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
							<path d="M7 4 L12 9 L7 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>
				</div>
			</div>
		</section>
	);
}

// ── Entry component ──────────────────────────────────────────────────────────

export function LandingExperience(): React.JSX.Element {
	const root = useRef<HTMLDivElement>(null);
	const takeTrack = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			// All motion is gated behind "no-preference". When a learner prefers
			// reduced motion none of these tweens are created, no start-states are
			// applied, and the SSR markup renders fully visible and readable. The
			// static page IS the reduced-motion experience.
			const mm = gsap.matchMedia();

			// ── Universal entrance + reveals (any width, motion allowed) ───────────
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				// Lenis smooth scroll, scoped to the home page (this component) and to
				// motion-allowed visitors only. `autoRaf: false` hands the frame loop to
				// GSAP's ticker so Lenis and every ScrollTrigger pin advance on the same
				// clock — without this they drift and pinned beats judder. mm.revert()
				// (on unmount / reduced-motion change) runs the returned teardown.
				const lenis = new Lenis({ autoRaf: false });
				lenis.on("scroll", ScrollTrigger.update);
				const drive = (time: number): void => {
					lenis.raf(time * 1000); // gsap ticker time is seconds; Lenis wants ms
				};
				gsap.ticker.add(drive);
				gsap.ticker.lagSmoothing(0);

				// Hero entrance: watermark + kicker → headline (word stagger) → lede →
				// CTAs → card → scroll cue. One confident, weighted opening.
				// fromTo (not from) on every autoAlpha element: the `[data-hero-hidden]`
				// CSS hides these at first paint to kill the pre-hydration flash, so the
				// tween must animate explicitly TO visible rather than back to the CSS
				// opacity:0 a plain `.from()` would read as the end state.
				// Tight, cohesive entrance using explicit positions (relative offsets
				// were compounding into gaps that left the kicker alone for a beat). The
				// kicker and headline start almost together, the card joins in parallel,
				// and the lede/CTAs cascade right behind, so the whole hero arrives as
				// one quick sweep rather than a sequence of separate reveals.
				const heroIn = gsap.timeline({ defaults: { ease: EXPO_OUT, duration: 0.6 } });
				heroIn
					.fromTo("[data-hero=\"kanji\"]", { autoAlpha: 0, scale: 1.06 }, { autoAlpha: 1, scale: 1, duration: 1.3 }, 0)
					.fromTo("[data-hero=\"kicker\"]", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45 }, 0)
					.fromTo("[data-hero=\"word\"]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.6 }, 0.1)
					.fromTo("[data-hero=\"card\"]", { autoAlpha: 0, y: 36, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8 }, 0.18)
					.fromTo("[data-hero=\"lede\"]", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.4)
					.fromTo("[data-hero=\"cta\"]", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.5 }, 0.52)
					.fromTo("[data-hero=\"cue\"]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.8);

				gsap.to("[data-hero=\"cue-mark\"]", { y: 7, duration: 1.4, ease: "sine.inOut", repeat: -1, yoyo: true });

				// Hero parallax: the card drifts up faster than the page, the watermark
				// slower — depth as the fold begins to leave.
				gsap.to("[data-hero=\"card\"]", {
					yPercent: -14,
					ease: "none",
					scrollTrigger: { trigger: "[data-hero=\"section\"]", start: "top top", end: "bottom top", scrub: true },
				});
				gsap.to("[data-hero=\"kanji\"]", {
					yPercent: -8,
					ease: "none",
					scrollTrigger: { trigger: "[data-hero=\"section\"]", start: "top top", end: "bottom top", scrub: true },
				});

				// Talky bands (why / coverage): children stagger up on enter.
				gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((group) => {
					gsap.from(Array.from(group.children) as HTMLElement[], {
						autoAlpha: 0,
						y: 28,
						duration: 1.0,
						ease: EXPO_OUT,
						stagger: 0.1,
						scrollTrigger: { trigger: group, start: "top 80%", once: true },
					});
				});

				// Stat count-up: 0 → 7,370 once the coverage block is in view.
				const counter = root.current?.querySelector<HTMLElement>("[data-count]");
				if (counter) {
					const proxy = { v: 0 };
					gsap.to(proxy, {
						v: 7370,
						duration: 1.8,
						ease: "power2.out",
						scrollTrigger: { trigger: counter, start: "top 85%", once: true },
						onUpdate: () => {
							counter.textContent = Math.round(proxy.v).toLocaleString("en-US");
						},
					});
				}

				// Hero card: a subtle cursor-follow 3D tilt for tactility. quickTo keeps
				// the rotation on the compositor and eases it back to rest on leave. The
				// scroll parallax (yPercent) and this tilt (rotationX/Y) are different
				// transform channels, so GSAP composes them without conflict.
				let teardownTilt = (): void => {};
				const heroCard = root.current?.querySelector<HTMLElement>("[data-hero=\"card\"]");
				if (heroCard) {
					gsap.set(heroCard, { transformPerspective: 900, transformOrigin: "center" });
					const rotX = gsap.quickTo(heroCard, "rotationX", { duration: 0.5, ease: "power3.out" });
					const rotY = gsap.quickTo(heroCard, "rotationY", { duration: 0.5, ease: "power3.out" });
					const onMove = (e: PointerEvent): void => {
						const r = heroCard.getBoundingClientRect();
						const px = (e.clientX - r.left) / r.width - 0.5;
						const py = (e.clientY - r.top) / r.height - 0.5;
						rotY(px * 7);
						rotX(-py * 7);
					};
					const onLeave = (): void => {
						rotX(0);
						rotY(0);
					};
					heroCard.addEventListener("pointermove", onMove);
					heroCard.addEventListener("pointerleave", onLeave);
					teardownTilt = (): void => {
						heroCard.removeEventListener("pointermove", onMove);
						heroCard.removeEventListener("pointerleave", onLeave);
					};
				}

				return () => {
					teardownTilt();
					gsap.ticker.remove(drive);
					gsap.ticker.lagSmoothing(500, 33); // restore GSAP's ticker default
					lenis.destroy();
				};
			});

			// (Tablet / phone use the interactive <MobileTake> tap-through, not a
			//  scroll reveal, so there is no small-viewport branch here.)

			// ── Desktop, motion allowed: arm the pinned continuous take ───────────
			mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
				const track = takeTrack.current;
				if (!track)
					return;
				const acts = gsap.utils.toArray<HTMLElement>("[data-act]");
				if (acts.length === 0)
					return;

				// Collapse the stacked bands into one viewport-height stage: every act
				// becomes a full-bleed overlay, only the first visible. mm.revert()
				// tears all of this down for reduced-motion / resize back to mobile.
				gsap.set(track, { height: "100vh" });
				acts.forEach((act, i) => {
					gsap.set(act, { position: "absolute", inset: 0, autoAlpha: i === 0 ? 1 : 0 });
				});

				// Pre-stage the FSRS curve so it can draw on the finale beat.
				const curvePath = track.querySelector<SVGPathElement>("[data-curve] path[fill=\"none\"]");
				const curveFill = track.querySelector<SVGPathElement>("[data-curve] path[opacity]");
				const curveDot = track.querySelector<SVGCircleElement>("[data-curve] circle");
				let curveLen = 0;
				if (curvePath) {
					curveLen = curvePath.getTotalLength();
					gsap.set(curvePath, { strokeDasharray: curveLen, strokeDashoffset: curveLen });
				}
				if (curveFill)
					gsap.set(curveFill, { opacity: 0 });
				if (curveDot)
					gsap.set(curveDot, { autoAlpha: 0 });

				// The master timeline: pinned, scrubbed. Each segment cross-fades the
				// previous act out and the next act in. ~1.35 viewport of scroll per
				// transition lets each feature hold longer and the morph between them
				// breathe, while still resolving before the scroll feels endless.
				// Step indicator ("one card, beat N of 4"): the dots + counter that make
				// the morph legible as a single card moving through stages. Driven from
				// the pin's scroll progress, not the timeline, to avoid a self-reference.
				const stepDots = Array.from(track.querySelectorAll<HTMLElement>("[data-step-dot]"));
				const stepCount = track.querySelector<HTMLElement>("[data-step-count]");
				const setStep = (idx: number): void => {
					stepDots.forEach((dot, j) => {
						dot.classList.toggle("bg-inari-vermillion", j === idx);
						dot.classList.toggle("scale-150", j === idx);
						dot.classList.toggle("bg-sumi-ink/25", j !== idx);
					});
					if (stepCount)
						stepCount.textContent = `${idx + 1} of ${acts.length}`;
				};
				setStep(0);

				const tl = gsap.timeline({
					defaults: { ease: "power2.inOut" },
					scrollTrigger: {
						trigger: track,
						start: "top top",
						end: `+=${(acts.length - 1) * 135}%`,
						pin: true,
						scrub: 0.7,
						anticipatePin: 1,
						onUpdate: self => setStep(Math.round(self.progress * (acts.length - 1))),
					},
				});

				acts.forEach((act, i) => {
					if (i === 0)
						return;
					const prev = acts[i - 1];
					if (!prev)
						return;
					const flip = act.dataset.actFlip === "1";
					const copy = act.querySelector<HTMLElement>("[data-act-copy]");
					const face = act.querySelector<HTMLElement>("[data-act-face]");
					const label = `act${i}`;
					tl.addLabel(label);

					// Outgoing act lifts and dissolves.
					tl.to(prev, { autoAlpha: 0, yPercent: -6, duration: 0.5 }, label);

					// Incoming act resolves into the same frame. The card face shares the
					// slot, so it reads as the one card changing — except the mnemonic
					// beat, which physically turns the card over on its Y axis.
					tl.fromTo(act, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, label);
					if (copy)
						tl.fromTo(copy, { autoAlpha: 0, x: -36 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: EXPO_OUT }, label);
					if (face) {
						tl.fromTo(
							face,
							flip
								? { autoAlpha: 0, rotationY: -110, transformPerspective: 900, transformOrigin: "center center" }
								: { autoAlpha: 0, y: 44, scale: 0.96 },
							flip
								? { autoAlpha: 1, rotationY: 0, duration: 0.8, ease: EXPO_OUT }
								: { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: EXPO_OUT },
							label,
						);
					}

					// Finale: the forgetting curve draws as the last act resolves.
					if (i === acts.length - 1 && curvePath) {
						tl.to(curvePath, { strokeDashoffset: 0, ease: "none", duration: 0.9 }, label);
						if (curveFill)
							tl.to(curveFill, { opacity: 0.08, duration: 0.5 }, label);
						if (curveDot)
							tl.to(curveDot, { autoAlpha: 1, duration: 0.2 }, ">-0.1");
					}
				});
			});

			return () => mm.revert();
		},
		{ scope: root },
	);

	return (
		<div ref={root}>
			{/* ── Hero: full-bleed 100vh opening. A WebGL sumi-ink shader breathes
          behind edge-to-edge type, a giant 友 bleeds off the right edge, and the
          nav floats transparent over the top. ── */}
			<section data-hero="section" className="relative -mt-16 w-full overflow-hidden">
				{/* Layer order (all -z-10, painted by DOM order): CSS wash → shader
            canvas → legibility scrim. The wash is the WebGL fallback. */}
				<div
					aria-hidden="true"
					className="absolute inset-0 -z-10 bg-[radial-gradient(125%_120%_at_70%_26%,var(--color-warm-paper-raised)_0%,var(--color-warm-paper-base)_44%,var(--color-cream-inset)_100%)]"
				/>
				<InkShaderCanvas className="absolute inset-0 -z-10 h-full w-full" />
				<div
					aria-hidden="true"
					className="absolute inset-0 -z-10 bg-gradient-to-r from-warm-paper-base/70 via-warm-paper-base/10 to-transparent"
				/>

				<span
					data-hero="kanji"
					data-hero-hidden
					aria-hidden="true"
					lang="ja"
					className="pointer-events-none absolute right-[2%] top-1/2 z-0 -translate-y-1/2 select-none font-japanese leading-none text-inari-vermillion/[0.07] text-[64vw] lg:text-[46rem]"
				>
					友
				</span>

				<div className="relative z-10 grid min-h-[100svh] w-full items-center gap-10 px-6 pt-16 sm:px-10 lg:grid-cols-[1.4fr_1fr] lg:gap-10 lg:px-16">
					<div className="flex flex-col gap-5">
						<div data-hero="kicker" data-hero-hidden>
							<SectionKicker>Japanese spaced repetition</SectionKicker>
						</div>
						{/* Edge-to-edge display type that breaks the reading measure on
                purpose — the headline is the hero, not a column of it. */}
						<h1 className="font-display font-semibold leading-[0.95] tracking-[-0.02em] text-sumi-ink text-[clamp(2.75rem,8.4vw,8rem)]">
							{HEADLINE_WORDS.map((word, i) => (
								<Fragment key={`${word}-${i}`}>
									<span data-hero="word" data-hero-hidden className="inline-block">
										{word}
									</span>
									{i < HEADLINE_WORDS.length - 1 ? " " : ""}
								</Fragment>
							))}
						</h1>
						<p data-hero="lede" data-hero-hidden className="max-w-measure text-base leading-[1.6] text-faded-sumi md:text-md">
							Quiet daily reviews, scheduling that times each card to the moment you’re about to forget
							it, and a teacher’s eye for the words that need another pass, all in one calm app.
						</p>
						<div className="flex flex-wrap items-center gap-3 pt-1">
							<span data-hero="cta" data-hero-hidden className="inline-flex">
								<ButtonLink href="/signup" size="lg" trailingIcon={<ArrowGlyph direction="right" />}>
									Start practicing
								</ButtonLink>
							</span>
							<span data-hero="cta" data-hero-hidden className="inline-flex">
								<ButtonLink href="/login" size="lg" variant="secondary">
									Sign in
								</ButtonLink>
							</span>
						</div>
					</div>

					{/* The protagonist card, brought forward from the deck. The same
              vermillion-striped frame reappears through the continuous take. */}
					<div data-hero="card" data-hero-hidden className="flex w-full justify-center lg:justify-end">
						<Card variant="default" className="w-full max-w-lg">
							<div className="flex flex-col gap-5">
								<span className="self-start rounded-full bg-cream-inset px-2.5 py-0.5 text-xs font-medium text-faded-sumi">
									Reading
								</span>
								<div className="flex flex-col items-center gap-2 py-2 text-center">
									<FuriganaText
										text="食べる"
										reading="たべる"
										className="font-japanese text-5xl font-medium text-sumi-ink"
									/>
									<p className="text-base text-faded-sumi">to eat</p>
								</div>
								<Card variant="surface">
									<p lang="ja" className="font-japanese text-lg leading-relaxed text-sumi-ink">
										朝ごはんを
										<FuriganaText text="食" reading="た" />
										べる。
									</p>
									<p className="mt-2 text-sm text-faded-sumi">I eat breakfast.</p>
								</Card>
								<div className="flex items-center justify-between">
									<span className="text-xs text-faded-sumi">Next review</span>
									<span className="font-mono text-sm text-sumi-ink">5d</span>
								</div>
							</div>
						</Card>
					</div>

					{/* Scroll cue — anchored to the hero, fades in last, bobs gently. */}
					<div
						data-hero="cue"
						data-hero-hidden
						className="pointer-events-none absolute inset-x-0 bottom-6 hidden flex-col items-center gap-1 text-faded-sumi lg:flex"
					>
						<span className="text-xs tracking-wide">Scroll</span>
						<svg data-hero="cue-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</div>
				</div>
			</section>

			{/* ── Why Tomo: three outcome-led reasons, each with a hands-on proof
          (interactive retention curve, tap-to-explain card, calm/streak
          toggle). Self-contained client component; no scroll-pin, so it never
          competes with the continuous take below. ─────────────────────────── */}
			<WhyTomo />

			{/* ── The continuous take: one card, four beats. Desktop gets the pinned
          scrub; mobile gets an interactive tap-through. The #features anchor
          lives on the wrapper so it resolves on both (each variant hides at the
          other's breakpoint). ──────────────────────────────────────────────── */}
			<div id="features" className="scroll-mt-16">
				<ContinuousTake trackRef={takeTrack} />
				<MobileTake />
			</div>

			{/* ── Coverage (id=coverage) — the decks band: copy + stat on the left,
          a JLPT coverage ladder on the right. ──────────────────────────────── */}
			<section aria-labelledby="coverage" className="relative overflow-hidden bg-cool-paper-shade py-20 md:py-28">
				<span
					aria-hidden="true"
					lang="ja"
					className="pointer-events-none absolute left-[10%] top-1/2 z-0 -translate-y-1/2 select-none font-japanese leading-none text-sumi-ink/[0.04] text-[44vw] lg:text-[26rem]"
				>
					全
				</span>

				<div className={`${INNER} relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
					<div data-reveal className="flex flex-col gap-5">
						<SectionKicker>Ready on day one</SectionKicker>
						<h2
							id="coverage"
							className="max-w-[20ch] font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-sumi-ink md:text-4xl"
						>
							Every JLPT level, already built.
						</h2>
						<p className="max-w-measure text-base leading-[1.6] text-faded-sumi">
							Start from complete, ordered JLPT vocabulary, with readings, pitch accent, example
							sentences, and mnemonics included, alongside Joyo kanji and grammar patterns. Subscribe to
							a deck and your first week of reviews is scheduled before the coffee cools. Or add your own
							words in seconds.
						</p>
						<div className="mt-2 flex flex-wrap items-end gap-x-10 gap-y-5">
							<div className="flex flex-col">
								<span data-count className="font-mono text-5xl font-medium tabular-nums text-sumi-ink">
									7,370
								</span>
								<span className="text-sm text-faded-sumi">cards ready to study</span>
							</div>
							<div className="flex flex-col gap-1">
								<span className="text-sm text-faded-sumi">Also included</span>
								<span className="font-mono text-sm tracking-wide text-sumi-ink">Joyo kanji · Grammar patterns</span>
							</div>
						</div>
					</div>

					{/* JLPT ladder — the card identity device (vermillion top-stripe), the
              six levels each marked in its canonical level colour. */}
					<div data-reveal className="lg:justify-self-end">
						<div className="relative w-full max-w-md overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised px-6 pb-6 pt-7">
							<span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-inari-vermillion" />
							<p className="font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">
								JLPT ladder · N5 → Beyond
							</p>
							<ul className="mt-4 flex flex-col">
								{JLPT_LEVELS.map(level => (
									<li
										key={level.code}
										className="group relative flex items-center gap-4 border-t border-soft-hairline py-3 first:border-t-0 first:pt-0"
									>
										{/* Level-colour wash fades in on hover, using each level's own
                        canonical tint, so the ladder rewards exploration. */}
										<span
											aria-hidden="true"
											className="pointer-events-none absolute inset-x-[-1rem] inset-y-px -z-0 rounded-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100"
											style={{ backgroundColor: `var(${level.varName.replace("-text", "-bg")})` }}
										/>
										<span
											aria-hidden="true"
											className="relative z-10 size-2.5 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-[1.6]"
											style={{ backgroundColor: `var(${level.varName})` }}
										/>
										<span className="relative z-10 w-16 shrink-0 font-mono text-sm font-medium text-sumi-ink">{level.code}</span>
										<span className="relative z-10 text-sm leading-snug text-faded-sumi transition-colors duration-300 group-hover:text-sumi-ink">
											{level.desc}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* ── Closing CTA (saturated brand drench) ──────────────────────────── */}
			<section aria-labelledby="cta-begin" className="bg-inari-vermillion text-warm-paper-raised">
				<div data-reveal className={`${INNER} flex flex-col items-center gap-6 py-20 text-center md:py-28`}>
					<span>
						<Logo size={56} wordmarkSize="xl" tone="inverted" />
					</span>
					<h2 id="cta-begin" className="font-display text-3xl font-semibold leading-tight md:text-4xl">
						Begin where you are.
					</h2>
					<p className="max-w-measure text-base text-warm-paper-raised/90">
						Pick your JLPT level, choose a few decks, and review your first cards in minutes.
					</p>
					<span>
						<ButtonLink href="/signup" size="lg" variant="secondary" trailingIcon={<ArrowGlyph direction="right" />}>
							Start practicing
						</ButtonLink>
					</span>
				</div>
			</section>
		</div>
	);
}

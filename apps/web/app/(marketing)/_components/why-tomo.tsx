"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";

import { FuriganaText } from "@/components/ui/FuriganaText";
import { SectionKicker } from "@/components/ui/SectionKicker";
import { cn } from "@/lib/utils";

// The "Why Tomo" band: three outcome-led reasons a learner chooses Tomo, each
// backed by a hands-on proof rather than a claim. Deliberately asymmetric — a
// wide retention curve, a narrow tap-to-explain card, then a full-width calm
// toggle — so the three never read as an identical card grid. All motion here
// is interaction-driven (drag / tap / toggle); the section's *entrance* is left
// to the parent's [data-reveal] scroll stagger, and the breathing loop is the
// only ambient tween, gated behind no-preference.

/**
 * Shared card chrome. Distinct internal structure per reason keeps the grid
 *  from collapsing into clones; this only unifies border, radius, and paper.
 */
const CARD = "rounded-xs border border-soft-hairline bg-warm-paper-raised";

/**
 * prefers-reduced-motion as reactive state. SSR-safe: starts false, resolves
 *  on mount, and updates live if the OS setting flips.
 */
function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = (): void => setReduced(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	return reduced;
}

/** Mono index marker shared by all three reasons (01 / 02 / 03). */
function ReasonIndex({ n }: { n: number }): React.JSX.Element {
	return (
		<span className="font-mono text-xs font-medium tabular-nums tracking-[0.16em] text-inari-vermillion">
			{`0${n}`}
		</span>
	);
}

// ── Reason 01: Remember more for less time ───────────────────────────────────
// An interactive forgetting curve. Two memories of the same word are plotted:
// one never reviewed (decays fast to ~20%), one Tomo schedules (each review
// resets recall and lengthens the next interval, so it holds near the top). The
// learner drags a handle along 30 days and reads the gap at any point. Recall
// uses the real FSRS-shaped model R = 0.9^(t / S); numbers are illustrative.
function RememberProof(): React.JSX.Element {
	const svgRef = useRef<SVGSVGElement>(null);
	const draggingRef = useRef(false);
	const [day, setDay] = useState(14);

	const W = 480;
	const H = 220;
	const PL = 44;
	const PR = 18;
	const PT = 16;
	const PB = 34;
	const DMAX = 30;
	const plotW = W - PL - PR;
	const plotH = H - PT - PB;

	const xOf = (d: number): number => PL + (d / DMAX) * plotW;
	const yOf = (r: number): number => PT + (1 - r) * plotH;

	// Tomo's expanding review schedule. Each interval doubles-ish; setting each
	// segment's stability equal to its interval makes recall fall to exactly 0.9
	// right as the next review fires — the "edge of forgetting" the copy names.
	const reviews: readonly number[] = [0, 1, 3, 8, 18];
	const intervals: readonly number[] = [1, 2, 5, 10, 24];

	const tomoRecall = (t: number): number => {
		let lastReview = 0;
		let stability = 1;
		for (let k = 0; k < reviews.length; k++) {
			const rev = reviews[k];
			const iv = intervals[k];
			if (rev === undefined || iv === undefined || t < rev)
				continue;
			lastReview = rev;
			stability = iv;
		}
		return 0.9 ** ((t - lastReview) / stability);
	};
	// A single exposure with no review: low stability, steep early decay.
	const othersRecall = (t: number): number => 0.9 ** (t / 2.5);

	const buildPoints = (fn: (t: number) => number): string => {
		const out: string[] = [];
		for (let t = 0; t <= DMAX + 1e-9; t += 0.25) {
			const tt = Math.min(t, DMAX);
			out.push(`${xOf(tt).toFixed(1)},${yOf(fn(tt)).toFixed(1)}`);
		}
		return out.join(" ");
	};

	const tomoPts = buildPoints(tomoRecall);
	const othersPts = buildPoints(othersRecall);

	const tomoPct = Math.round(tomoRecall(day) * 100);
	const othersPct = Math.round(othersRecall(day) * 100);

	const setDayFromClientX = (clientX: number): void => {
		const svg = svgRef.current;
		if (!svg)
			return;
		const rect = svg.getBoundingClientRect();
		const svgX = ((clientX - rect.left) / rect.width) * W;
		const d = ((svgX - PL) / plotW) * DMAX;
		setDay(Math.max(0, Math.min(DMAX, Math.round(d))));
	};

	const onPointerDown = (e: React.PointerEvent<SVGRectElement>): void => {
		draggingRef.current = true;
		e.currentTarget.setPointerCapture(e.pointerId);
		setDayFromClientX(e.clientX);
	};
	const onPointerMove = (e: React.PointerEvent<SVGRectElement>): void => {
		if (draggingRef.current)
			setDayFromClientX(e.clientX);
	};
	const onPointerUp = (): void => {
		draggingRef.current = false;
	};
	const onKeyDown = (e: React.KeyboardEvent<SVGGElement>): void => {
		const big = e.shiftKey ? 5 : 1;
		if (e.key === "ArrowRight" || e.key === "ArrowUp") {
			e.preventDefault();
			setDay(d => Math.min(DMAX, d + big));
		} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
			e.preventDefault();
			setDay(d => Math.max(0, d - big));
		} else if (e.key === "Home") {
			e.preventDefault();
			setDay(0);
		} else if (e.key === "End") {
			e.preventDefault();
			setDay(DMAX);
		}
	};

	const handleX = xOf(day);
	const tomoDotY = yOf(tomoRecall(day));
	const othersDotY = yOf(othersRecall(day));

	return (
		<div className="mt-5">
			<svg
				ref={svgRef}
				viewBox={`0 0 ${W} ${H}`}
				width="100%"
				className="touch-none select-none"
				style={{ aspectRatio: `${W} / ${H}` }}
				role="img"
				aria-label="Retention over thirty days: a reviewed card holds near full recall while an unreviewed card fades."
			>
				{/* Horizontal guide lines at 100 / 50 / 20 percent. */}
				{[1, 0.5, 0.2].map(r => (
					<g key={r}>
						<line
							x1={PL}
							y1={yOf(r)}
							x2={W - PR}
							y2={yOf(r)}
							stroke="var(--color-soft-hairline)"
							strokeWidth="1"
							strokeDasharray="2 4"
						/>
						<text
							x={PL - 8}
							y={yOf(r) + 4}
							textAnchor="end"
							fontSize="10"
							fill="var(--color-faded-sumi)"
							fontFamily="var(--font-mono)"
						>
							{`${r * 100}%`}
						</text>
					</g>
				))}
				{[0, 10, 20, 30].map(d => (
					<text
						key={d}
						x={xOf(d)}
						y={H - PB + 18}
						textAnchor="middle"
						fontSize="10"
						fill="var(--color-faded-sumi)"
						fontFamily="var(--font-mono)"
					>
						{`${d}d`}
					</text>
				))}

				{/* Unreviewed memory: faded, dashed, plummeting. */}
				<polyline
					points={othersPts}
					fill="none"
					stroke="var(--color-faded-sumi)"
					strokeWidth="1.5"
					strokeDasharray="3 4"
					strokeLinecap="round"
					opacity="0.7"
				/>
				{/* Tomo's scheduled memory: vermillion, held high by reviews. */}
				<polyline
					points={tomoPts}
					fill="none"
					stroke="var(--color-inari-vermillion)"
					strokeWidth="2.5"
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
				{/* Review markers sit at each reset point. */}
				{reviews.map(rev => (
					<circle
						key={rev}
						cx={xOf(rev)}
						cy={yOf(1)}
						r="3"
						fill="var(--color-warm-paper-raised)"
						stroke="var(--color-inari-vermillion)"
						strokeWidth="1.5"
					/>
				))}

				{/* Draggable readout handle. */}
				<line
					x1={handleX}
					y1={PT}
					x2={handleX}
					y2={H - PB}
					stroke="var(--color-sumi-ink)"
					strokeWidth="1"
					opacity="0.5"
				/>
				<circle cx={handleX} cy={othersDotY} r="3.5" fill="var(--color-faded-sumi)" />
				<circle cx={handleX} cy={tomoDotY} r="4.5" fill="var(--color-inari-vermillion)" />

				{/* Keyboard-operable slider handle (focusable group). */}
				<g
					role="slider"
					tabIndex={0}
					aria-label="Day"
					aria-valuemin={0}
					aria-valuemax={DMAX}
					aria-valuenow={day}
					aria-valuetext={`Day ${day}: Tomo ${tomoPct} percent recall, without review ${othersPct} percent`}
					onKeyDown={onKeyDown}
					className="cursor-ew-resize outline-none [&:focus-visible_circle]:stroke-sumi-ink"
				>
					<circle
						cx={handleX}
						cy={tomoDotY}
						r="9"
						fill="transparent"
						stroke="transparent"
						strokeWidth="2"
					/>
				</g>

				{/* Full-height hit area so a drag can start anywhere on the plot. */}
				<rect
					x={PL}
					y={PT}
					width={plotW}
					height={plotH}
					fill="transparent"
					className="cursor-ew-resize"
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
				/>
			</svg>

			{/* Live readout: the gap, in words, at the dragged day. */}
			<div
				aria-live="polite"
				className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
			>
				<span className="font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">
					Day
					{" "}
					{day}
				</span>
				<span className="flex items-baseline gap-2">
					<span className="font-mono text-2xl font-medium tabular-nums text-inari-vermillion">
						{tomoPct}
						%
					</span>
					<span className="text-sm text-faded-sumi">with Tomo</span>
				</span>
				<span className="flex items-baseline gap-2">
					<span className="font-mono text-2xl font-medium tabular-nums text-faded-sumi">
						{othersPct}
						%
					</span>
					<span className="text-sm text-faded-sumi">no review</span>
				</span>
			</div>
			<p className="mt-2 text-xs text-faded-sumi">Illustrative recall across thirty days.</p>
		</div>
	);
}

// ── Reason 02: Understand, not just recognize ────────────────────────────────
// A flashcard front and back tells you what a word means. Tomo tells you why.
// Tapping a facet streams a short, teacherly note in (typed for tactility,
// instant under reduced motion). The point: comprehension, not bare recall.
const FACETS = [
	{
		key: "reading",
		label: "Reading",
		note: "たべる. The 食 takes its kun’yomi た here, the everyday reading you meet at the table.",
	},
	{
		key: "conjugation",
		label: "Conjugation",
		note: "An ichidan verb. Drop る for たべます, たべない, and たべて. The stem never shifts on you.",
	},
	{
		key: "hook",
		label: "Memory hook",
		note: "Picture a lid set over a mouth: food kept warm, waiting to be 食べる, to be eaten.",
	},
] as const;

type FacetKey = (typeof FACETS)[number]["key"];

function UnderstandProof(): React.JSX.Element {
	const reduced = useReducedMotion();
	const [active, setActive] = useState<FacetKey>("reading");
	const [shown, setShown] = useState<string>(FACETS[0].note);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => () => window.clearInterval(timer.current), []);

	const select = (facet: (typeof FACETS)[number]): void => {
		setActive(facet.key);
		window.clearInterval(timer.current);
		if (reduced) {
			setShown(facet.note);
			return;
		}
		let i = 0;
		setShown("");
		timer.current = window.setInterval(() => {
			i += 1;
			setShown(facet.note.slice(0, i));
			if (i >= facet.note.length)
				window.clearInterval(timer.current);
		}, 16);
	};

	return (
		<div className="mt-5 flex flex-col gap-4">
			<div className={cn(CARD, "bg-cream-inset px-5 py-4")}>
				<FuriganaText
					text="食べる"
					reading="たべる"
					className="font-japanese text-4xl font-medium text-sumi-ink"
				/>
				<p className="mt-1 text-sm text-faded-sumi">to eat</p>
			</div>

			<div className="flex flex-wrap gap-2">
				{FACETS.map(facet => (
					<button
						key={facet.key}
						type="button"
						aria-pressed={active === facet.key}
						onClick={() => select(facet)}
						className={cn(
							"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
							"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
							active === facet.key
								? "border-inari-vermillion bg-inari-vermillion text-warm-paper-raised"
								: "border-soft-hairline text-faded-sumi hover:border-inari-vermillion/45 hover:text-sumi-ink",
						)}
					>
						{facet.label}
					</button>
				))}
			</div>

			<p
				aria-live="polite"
				className="min-h-[4.5rem] text-base leading-[1.6] text-sumi-ink"
			>
				{shown}
			</p>
		</div>
	);
}

// ── Reason 03: A practice you want to return to ──────────────────────────────
// The emotional reason, made calm rather than comparative. Pick how long you
// have been away; Tomo answers the same way every time: your cards waited, no
// penalty, nothing expired. The concentric rings breathe on a 3s sine loop (the
// morning-ritual exhale), gated behind no-preference.
const AWAY = [
	{ key: "day", label: "a day", line: "A few cards are due. Pick up exactly where you left off." },
	{ key: "week", label: "a week", line: "A handful waited, quietly rescheduled. Nothing expired." },
	{ key: "month", label: "a month", line: "They are all still here, calmly re-timed for today." },
] as const;

type AwayKey = (typeof AWAY)[number]["key"];

function CalmProof(): React.JSX.Element {
	const reduced = useReducedMotion();
	const [away, setAway] = useState<AwayKey>("week");
	const ringRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (reduced || !ringRef.current)
				return;
			const tween = gsap.to(ringRef.current, {
				scale: 1.12,
				transformOrigin: "center",
				duration: 3.2,
				ease: "sine.inOut",
				repeat: -1,
				yoyo: true,
			});
			return () => {
				tween.kill();
			};
		},
		{ dependencies: [reduced], scope: ringRef },
	);

	const line = AWAY.find(o => o.key === away)?.line ?? AWAY[0].line;

	return (
		<div className="mt-5 flex flex-col gap-5 lg:mt-0 lg:items-end">
			<div role="group" aria-label="How long you have been away" className="flex flex-wrap items-center gap-2">
				<span className="mr-1 font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">Away for</span>
				{AWAY.map(opt => (
					<button
						key={opt.key}
						type="button"
						aria-pressed={away === opt.key}
						onClick={() => setAway(opt.key)}
						className={cn(
							"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
							"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
							away === opt.key
								? "border-inari-vermillion bg-inari-vermillion text-warm-paper-raised"
								: "border-soft-hairline text-faded-sumi hover:border-inari-vermillion/45 hover:text-sumi-ink",
						)}
					>
						{opt.label}
					</button>
				))}
			</div>

			<div className="flex w-full max-w-sm items-center gap-5 rounded-xs bg-cream-inset px-6 py-6">
				{/* Breathing concentric rings: the morning-ritual exhale. */}
				<div className="relative size-14 shrink-0">
					<div ref={ringRef} className="absolute inset-0">
						<span className="absolute inset-0 rounded-full border border-inari-vermillion/30" />
						<span className="absolute inset-[18%] rounded-full border border-inari-vermillion/50" />
						<span className="absolute inset-[42%] rounded-full bg-inari-vermillion/80" />
					</div>
				</div>
				<div className="flex flex-col">
					<span className="font-display text-lg font-semibold text-sumi-ink">Welcome back</span>
					<span aria-live="polite" className="text-sm text-faded-sumi">
						{line}
					</span>
				</div>
			</div>
		</div>
	);
}

export function WhyTomo(): React.JSX.Element {
	return (
		<section aria-labelledby="why-tomo" className="bg-warm-paper-base py-20 md:py-28">
			<div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
				<div data-reveal className="flex max-w-measure flex-col gap-4">
					<SectionKicker>Why Tomo</SectionKicker>
					<h2
						id="why-tomo"
						className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-sumi-ink md:text-4xl lg:text-5xl"
					>
						Why it sticks.
					</h2>
					<p className="text-base leading-[1.6] text-faded-sumi md:text-md">
						Not a longer feature list. Three things that decide how much Japanese you actually keep,
						each one you can try right here.
					</p>
				</div>

				{/* Asymmetric bento: wide curve + narrow word card on one row, then a
            full-width calm band. Different sizes and different internals are
            what keep this from reading as three identical cards. */}
				<div data-reveal className="mt-12 grid gap-4 lg:grid-cols-6 lg:gap-5">
					<article className={cn(CARD, "flex flex-col p-6 md:p-8 lg:col-span-4")}>
						<div className="flex items-center gap-3">
							<ReasonIndex n={1} />
							<h3 className="font-display text-xl font-semibold text-sumi-ink md:text-2xl">
								Remember more for less time.
							</h3>
						</div>
						<p className="mt-3 max-w-measure text-base leading-[1.6] text-faded-sumi">
							Tomo returns each card just before you would forget it. Same minutes of study, far more
							kept. Drag along the days and watch the two memories pull apart.
						</p>
						<RememberProof />
					</article>

					<article className={cn(CARD, "flex flex-col p-6 md:p-8 lg:col-span-2")}>
						<div className="flex items-center gap-3">
							<ReasonIndex n={2} />
							<h3 className="font-display text-xl font-semibold text-sumi-ink">
								Understand, not just recognize.
							</h3>
						</div>
						<p className="mt-3 text-base leading-[1.6] text-faded-sumi">
							Every card can explain itself. Tap a facet to see the reasoning, not just the answer.
						</p>
						<UnderstandProof />
					</article>

					<article
						className={cn(
							CARD,
							"grid gap-6 p-6 md:p-8 lg:col-span-6 lg:grid-cols-2 lg:items-center lg:gap-12",
						)}
					>
						<div className="flex flex-col">
							<div className="flex items-center gap-3">
								<ReasonIndex n={3} />
								<h3 className="font-display text-xl font-semibold text-sumi-ink md:text-2xl">
									A practice you want to return to.
								</h3>
							</div>
							<p className="mt-3 max-w-measure text-base leading-[1.6] text-faded-sumi">
								Miss a day and nothing scolds you. There is no streak to break, no red number counting
								your absence. Your cards simply wait, scheduled for whenever you sit down next.
							</p>
						</div>
						<CalmProof />
					</article>
				</div>
			</div>
		</section>
	);
}

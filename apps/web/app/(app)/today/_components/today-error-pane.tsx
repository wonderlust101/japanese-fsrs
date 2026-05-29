"use client";

/* ──────────────────────────────────────────────────────────────────────
   TodayWeekRhythmSilhouette

   Partial-failure placeholder for the week-strip when *only* the
   forecast query has errored. Keeps the chart silhouette (so the
   surface visibly belongs to the same module) but commits to the
   error mood with a display-weight headline anchored top-left and
   error-tint bars at full opacity along the bottom.

   The page-level error pane that used to live in this file moved to
   `components/ui/QueueErrorPane.tsx` so /today and /review/setup can
   share it. This silhouette is today-specific — it twins the live
   WeekRhythmStrip module — so it stays here.

   Composition: same SectionCard chrome as the live WeekRhythmStrip,
   then a single overlay region (168px tall) layering bars at the
   bottom with a left-aligned editorial statement (display "Unavailable."
   in error-deep + one supporting line) at the top. Recovery lives on
   the hero side via the regular refresh path; this surface is
   read-only.

   Hierarchy comes from scale + weight contrast (~2× ratio between
   headline and body) rather than from a small status pill or floating
   badge. The bars carry the error palette; the typography carries the
   message.
   ────────────────────────────────────────────────────────────────────── */

export function TodayWeekRhythmSilhouette(): React.JSX.Element {
	return (
		<section
			aria-label="The week ahead, unavailable"
			className="relative overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6"
		>
			<span
				aria-hidden="true"
				className="absolute inset-x-0 top-0 h-0.5 bg-inari-vermillion"
			/>
			<div className="flex items-baseline gap-x-3">
				<span aria-hidden="true" lang="ja" className="font-display text-xl text-sumi-ink/40">週</span>
				<span className="font-mono text-sm text-faded-sumi/80">
					The week ahead
				</span>
			</div>
			<hr aria-hidden="true" className="mt-4 border-0 border-t border-soft-hairline" />

			<div className="relative mt-5" style={{ height: "168px" }}>
				{/* Chart-shape silhouette anchored to the bottom. Matches the
            live WeekRhythmStrip's bar vocabulary (per-bar width cap +
            hairline base) so the slot reads as the same module, just
            sitting still. Heights are a gentle baseline rhythm rather
            than fake data spikes, so the bars don't compete with the
            editorial headline. */}
				<div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex flex-col">
					<ol
						className="flex items-end gap-2 sm:gap-2 lg:gap-3"
						style={{ height: "56px" }}
					>
						{[28, 36, 32, 40, 32, 28, 24].map((height, i) => (
							// eslint-disable-next-line react/no-array-index-key -- fixed decorative bar heights (static array, never reorders); index is the identity.
							<li key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end">
								<span
									className="block w-full max-w-[44px] origin-bottom rounded-t-[1px] bg-error-tint sm:max-w-[56px] lg:max-w-[72px]"
									style={{ height: `${height}px` }}
								/>
							</li>
						))}
					</ol>
					<hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />
				</div>

				{/* Editorial statement anchored top-left, sitting above the
            chart strip. Display headline does the heavy lifting; the
            ~2× scale jump to the body line carries the hierarchy. */}
				<div className="absolute inset-x-0 top-0 flex flex-col items-start">
					<h3 className="font-display text-title tracking-tight text-error-deep">
						Unavailable.
					</h3>
					<p className="mt-2 max-w-measure-tight text-sm leading-snug text-faded-sumi">
						The week ahead couldn&rsquo;t load right now.
					</p>
				</div>
			</div>
		</section>
	);
}

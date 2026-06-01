"use client";

import { MoreDisclosure } from "@/components/review/MoreDisclosure";
import { Button } from "@/components/ui/Button";

interface WeakSpotDiagnosisPanelProps {
	diagnosis: string | null;
	prescription: string | null;
	isLoading: boolean;
	isError: boolean;
	errorMessage?: string;
	onDiagnose: () => void;
	onRetry: () => void;
}

/**
 * AI-authored diagnosis + prescription surface. Uses the same dashed-
 * vermillion register as `regenerate-panel.tsx` so the visual register
 * across all AI moments stays consistent — anywhere the system speaks in
 * its "teacher's voice," the chrome looks the same.
 *
 * State machine:
 *   - empty (no diagnosis on record + not loading + not erroring): show a
 *     primer line + a "Diagnose this card" button.
 *   - loading: show a quiet "Reading the lapse pattern…" line + the disabled
 *     button.
 *   - error: show the error message + a "Try again" affordance.
 *   - filled: show diagnosis + (optionally) prescription, no button.
 *
 * Per the doc's IA guidance, the chrome label avoids "AI" in user-facing
 * copy. The kicker reads "Tomo's read" (the teacher framing). When diagnosis
 * content is present, a closed-by-default `MoreDisclosure` exposes a short
 * provenance line — what Tomo looked at, plus the reassurance that the read
 * doesn't change the schedule.
 */
export function WeakSpotDiagnosisPanel({
	diagnosis,
	prescription,
	isLoading,
	isError,
	errorMessage,
	onDiagnose,
	onRetry,
}: WeakSpotDiagnosisPanelProps): React.JSX.Element {
	const hasContent = diagnosis !== null && diagnosis.length > 0;

	return (
		<section
			aria-labelledby="weakSpot-diagnosis-heading"
			className="rounded-xs border border-dashed border-inari-vermillion bg-vermillion-wash/40 px-4 py-4 sm:px-5 sm:py-5"
		>
			<header className="mb-3 flex items-baseline gap-2 font-mono text-sm text-inari-vermillion-deep">
				<span
					lang="ja"
					aria-hidden="true"
					className="font-display text-sm leading-none translate-y-[0.05em] text-inari-vermillion"
				>
					助
				</span>
				<span id="weakSpot-diagnosis-heading">Tomo&rsquo;s read</span>
			</header>

			{hasContent
				? (
						<div className="animate-diagnosis-content-in flex flex-col gap-3">
							<p className="text-base leading-relaxed text-sumi-ink">
								{diagnosis}
							</p>
							{prescription !== null && prescription.length > 0 && (
								<p className="rounded-xs bg-vermillion-wash/50 px-3 py-2 text-base italic leading-relaxed text-sumi-ink/85">
									{prescription}
								</p>
							)}
							<div className="pt-1">
								<MoreDisclosure label="About this read">
									<p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
										Tomo&rsquo;s read is generated from this card&rsquo;s recent lapse
										pattern and review history. It doesn&rsquo;t change your schedule.
									</p>
								</MoreDisclosure>
							</div>
						</div>
					)
				: isError
					? (
							<div className="flex flex-col gap-3">
								<p className="text-sm leading-relaxed text-error-deep">
									{errorMessage ?? "Couldn’t generate a diagnosis. Try again in a moment."}
								</p>
								<div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="min-h-11 sm:min-h-0"
										onClick={onRetry}
										loading={isLoading}
									>
										Try again
									</Button>
								</div>
							</div>
						)
					: (
							<div className="flex flex-col gap-3">
								<p className="text-sm leading-relaxed text-sumi-ink/85">
									Read the lapse pattern and surface what&rsquo;s likely tripping comprehension on this card.
								</p>
								<div>
									<Button
										type="button"
										variant="primary"
										size="sm"
										className="min-h-11 sm:min-h-0"
										onClick={onDiagnose}
										loading={isLoading}
									>
										Diagnose this card
									</Button>
								</div>
							</div>
						)}
		</section>
	);
}

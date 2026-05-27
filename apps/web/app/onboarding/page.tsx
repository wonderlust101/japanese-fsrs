"use client";

import { useRouter } from "next/navigation";
import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { ForgettingCurve } from "@/components/srs/ForgettingCurve";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useOnboardingDevState } from "@/dev/panels/onboarding";

export default function OnboardingWelcomePage(): React.JSX.Element {
	useOnboardingDevState();
	const router = useRouter();

	return (
		<Card variant="default">
			<div className="flex flex-col gap-7">
				<header className="flex flex-col gap-2">
					<p className="text-sm font-mono text-faded-sumi">
						Tomo · Japanese spaced repetition
					</p>
					<h1 className="font-display text-2xl md:text-3xl font-semibold text-sumi-ink leading-[1.1] tracking-[-0.01em]">
						What are we working on?
					</h1>
				</header>

				<p className="text-base md:text-md font-medium text-sumi-ink leading-[1.55] max-w-measure">
					A few questions, then your first cards.
				</p>

				<div className="bg-cool-paper-shade rounded-xs p-4 md:p-6 border border-soft-hairline">
					<ForgettingCurve className="w-full" />
					<p className="text-sm italic text-faded-sumi mt-3 leading-[1.55]">
						Without practice, recall fades. Tomo schedules review cards just before they slip, so daily reviews stay focused.
					</p>
				</div>

				<div className="flex justify-end">
					<Button
						size="lg"
						onClick={() => router.push("/onboarding/level")}
						trailingIcon={<ArrowGlyph direction="right" />}
					>
						Begin
					</Button>
				</div>
			</div>
		</Card>
	);
}

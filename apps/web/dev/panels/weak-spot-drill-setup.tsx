"use client";

import Link from "next/link";
import { useCallback } from "react";

import {
	devSessionHref,
	DRILL_ATTEMPT_FIXTURES,
	DRILL_SESSION_FIXTURES,
} from "@/app/(app)/weak-spots/drill/_components/drill-fixtures";

import { useDevPanel } from "@/dev/useDevStatePanel";

/**
 * Register the Drill Setup dev panel — fixture-backed session and summary
 * shortcuts. Both groups render as link grids so the engineer can jump
 * straight into a fixture-seeded drill or pre-baked summary view without
 * touching the live mutation path.
 */
export function useWeakSpotDrillSetupDevState(): void {
	const render = useCallback(() => {
		// Build-time gate in POSITIVE block form so drill-fixtures tree-shakes out.
		if (process.env.NODE_ENV === "development") {
			return (
				<div className="flex flex-col gap-3">
					<DevSection title="Drill sessions">
						<div className="flex flex-wrap gap-1.5">
							{DRILL_SESSION_FIXTURES.map(f => (
								<Link
									key={f.key}
									href={devSessionHref(f.key)}
									title={f.description}
									className="rounded-[2px] border border-warm-paper-raised/20 bg-warm-paper-raised/8 px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/85 hover:bg-warm-paper-raised/20 hover:text-warm-paper-raised cursor-pointer transition-colors duration-150 ease-out"
								>
									{f.label}
								</Link>
							))}
						</div>
					</DevSection>

					<DevSection title="Pre-baked summaries">
						<div className="flex flex-wrap gap-1.5">
							{DRILL_ATTEMPT_FIXTURES.map(f => (
								<Link
									key={f.key}
									href={`${devSessionHref("mixed")}/summary?seed=${f.key}`}
									title={f.description}
									className="rounded-[2px] border border-warm-paper-raised/20 bg-warm-paper-raised/8 px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/85 hover:bg-warm-paper-raised/20 hover:text-warm-paper-raised cursor-pointer transition-colors duration-150 ease-out"
								>
									{f.label}
								</Link>
							))}
						</div>
					</DevSection>
				</div>
			);
		}
		return null;
	}, []);

	useDevPanel({
		id: "weak-spots.drill.setup",
		title: "Drill · Setup",
		render,
	});
}

function DevSection({
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

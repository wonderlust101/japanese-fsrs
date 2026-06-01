import { KitsuneEmptyState } from "@/components/ui/KitsuneEmptyState";

interface WeakSpotsEmptyProps {
	variant: "unresolved" | "resolved";
}

/**
 * Empty state for the weakSpots page. Two variants matching the doc's
 * empty-state copy contract:
 *
 *   - unresolved: nothing to triage right now. Calm reassurance.
 *   - resolved:   no resolved-weakSpot history yet. Inert mode.
 *
 * Uses the shared {@link KitsuneEmptyState} brand beat (the same archetype the
 * Insights pages reach for) so only the copy varies per surface — this view
 * previously hand-rolled the identical kitsune-mark/headline/quiet-link markup.
 */
export function WeakSpotsEmpty({ variant }: WeakSpotsEmptyProps): React.JSX.Element {
	const isUnresolved = variant === "unresolved";

	return (
		<KitsuneEmptyState
			ariaLabel={isUnresolved ? "No unresolved weak spots" : "No resolved weak spots"}
			headline={isUnresolved ? "No weak spots right now." : "No resolved weak spots yet."}
			body={isUnresolved
				? "Keep your daily reviews steady; this list fills only when a card needs extra attention."
				: "Cards you resolve will show up here, so you can see the pattern of what got better over time."}
			ctaHref={isUnresolved ? "/today" : "/cards"}
			ctaLabel={isUnresolved ? "Start a review" : "Open your cards"}
		/>
	);
}

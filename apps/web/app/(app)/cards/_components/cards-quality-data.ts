/**
 * Shared types for the card-quality data emitted by the
 * `/api/v1/insights/card-quality` endpoint (Stage-8
 * `get_card_quality_issues` RPC).
 *
 * Lifted out of the deleted `cards-quality-bars.tsx` so consumers
 * (saved-views storage, view dropdown count derivation) can reference
 * the shape without depending on a defunct UI component.
 *
 * The backend currently emits six issue kinds. Audio / pitch counts
 * exist in the underlying data but are not surfaced here yet, so the
 * matching saved views render without a count badge until the endpoint
 * is extended.
 */
export type CardQualityIssueKind
	= | "missing_reading"
		| "missing_meaning"
		| "missing_example"
		| "missing_mnemonic"
		| "missing_picture"
		| "missing_nuance";

export interface CardQualityIssue {
	kind: CardQualityIssueKind;
	count: number;
}

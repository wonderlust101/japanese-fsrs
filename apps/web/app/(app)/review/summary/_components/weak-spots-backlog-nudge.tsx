import { QuietLink } from "@/components/ui/QuietLink";
import { useUnresolvedWeakSpotCount } from "@/lib/api/weak-spots";

// Calm cumulative-backlog signal at session close. Distinct from the in-card
// WeakSpotsCard, which lists weak spots *triggered this session*; this nudge
// surfaces the total unresolved backlog (which may include earlier sessions'
// weak spots) and points to the drill setup so the learner can follow through
// without hunting through nav. Silent during loading; DOM-absent when no
// unresolved weak spots exist.
export function WeakSpotsBacklogNudge(): React.JSX.Element | null {
	const { count, hasMore, isLoading } = useUnresolvedWeakSpotCount();
	if (isLoading)
		return null;
	if (count === 0)
		return null;

	const display = hasMore ? `${count}+` : String(count);
	const noun = count === 1 ? "weak spot" : "weak spots";

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-soft-hairline pt-6">
			<span
				lang="ja"
				aria-hidden="true"
				className="font-display text-lg leading-none text-inari-vermillion opacity-60"
			>
				弱
			</span>
			<p className="text-sm leading-relaxed text-faded-sumi">
				<span className="font-mono tabular-nums text-sumi-ink">{display}</span>
				{" "}
				{noun}
				{" "}
				still
				{count === 1 ? "needs" : "need"}
				{" "}
				a look.
			</p>
			<QuietLink
				href="/weak-spots/drill/setup"
				tone="brand"
				size="sm"
				trailingArrow
			>
				Drill them
			</QuietLink>
		</div>
	);
}

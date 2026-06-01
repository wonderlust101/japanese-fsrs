"use client";

/**
 * Motion-less CardStack. Previously orchestrated AnimatePresence-driven
 * page-turn transitions; the `motion` library has been removed, so this
 * renders a plain stack with no animation. The exported API (contentKey,
 * cardsBehind, direction, className, children) is preserved so call sites
 * don't need to change.
 */

interface CardStackProps {
	contentKey: string;
	cardsBehind?: number;
	direction?: "forward" | "backward";
	className?: string;
	children: React.ReactNode;
}

export function CardStack({
	contentKey,
	cardsBehind = 0,
	className = "",
	children,
}: CardStackProps): React.JSX.Element {
	const behindLayers = Array.from({ length: cardsBehind }, (_, i) => i + 1);

	return (
		<div className={["relative w-full", className].join(" ")}>
			{behindLayers.map((depth) => {
				const xOffset = depth * 6;
				const yOffset = depth * 8;
				const responsive = depth >= 2 ? "hidden md:block" : "block";

				return (
					<div
						key={`behind-${depth}`}
						aria-hidden="true"
						className={["absolute inset-0 pointer-events-none", responsive].join(" ")}
						style={{
							transform: `translate(${xOffset}px, ${yOffset}px)`,
							zIndex: -depth,
						}}
					>
						<div className="
              relative w-full h-full rounded-xs overflow-hidden
              bg-warm-paper-raised
              border-l border-r border-b border-soft-hairline
            "
						/>
					</div>
				);
			})}

			<div className="relative">
				<div key={contentKey} className="animate-page-enter">
					{children}
				</div>
			</div>
		</div>
	);
}

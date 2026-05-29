type CardVariant = "default" | "compact" | "surface" | "module";
type StripeTone = "brand" | "aizome" | "error" | "none";
type StripeWeight = "rule" | "hairline";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: CardVariant;
	/**
	 * Render as a `<section>` (with `aria-label` / `aria-labelledby`) when the
	 * card represents a labeled landmark. Defaults to `<div>` for unlabeled
	 * surfaces.
	 */
	as?: "div" | "section";
	/**
	 * Semantic stripe tone. Preferred over `stripeColor`. Maps to a CSS
	 * variable so the stripe stays themable. `none` hides the stripe.
	 */
	stripeTone?: StripeTone;
	/**
	 * Stripe weight. `rule` = 2px (default identity stripe). `hairline` = 1px,
	 * used by quieter "module" surfaces (e.g. Today's week-rhythm strip).
	 */
	stripeWeight?: StripeWeight;
	/** Free-form override of the stripe color. Use only when no token fits. */
	stripeColor?: string;
	/** Hide the stripe entirely (legacy). Prefer `stripeTone="none"`. */
	noStripe?: boolean;
	ref?: React.Ref<HTMLDivElement>;
}

const STRIPE_TONE_VAR: Record<Exclude<StripeTone, "none">, string> = {
	brand: "var(--color-inari-vermillion)",
	aizome: "var(--color-aizome-indigo)",
	error: "var(--color-error)",
};

/**
 * The Card primitive. The visual hero of the SRS-tool register.
 *
 * Anatomy:
 *   - 1px Soft Hairline border around all edges
 *   - 2px sharp corners (rounded-xs)
 *   - 2px Inari Vermillion top-edge stripe (the identity device)
 *   - Warm Paper Raised background (so the card reads as "warmer than the cool
 *     page beneath it")
 *   - No drop shadow. Depth comes from cards stacked behind, not from blur.
 *
 * Variants:
 *   - default: full-size card with generous internal padding (auth, onboarding)
 *   - compact: tighter padding for smaller cards (signup form section)
 *   - surface: nested surface inside a parent card (no stripe, lighter border)
 *   - module:  responsive padding rhythm (px-4 → sm:px-6 → lg:px-7 etc.) used
 *              for dashboard / Today modules. Pairs with `stripeTone` and
 *              `stripeWeight` so the card can carry brand, aizome, or error.
 */
export function Card({
	variant = "default",
	as = "div",
	stripeTone,
	stripeWeight = "rule",
	stripeColor,
	noStripe = false,
	className = "",
	children,
	ref,
	...rest
}: CardProps): React.JSX.Element {
	const Element = as as "div";
	const padding
		= variant === "compact"
			? "p-6"
			: variant === "surface"
				? "p-5"
				: variant === "module"
					? "px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7"
					: "p-8 md:p-10";

	const isSurface = variant === "surface";
	const isModule = variant === "module";

	const resolvedTone: StripeTone
		= stripeTone ?? (noStripe || isSurface ? "none" : "brand");
	const resolvedColor
		= stripeColor ?? (resolvedTone === "none" ? undefined : STRIPE_TONE_VAR[resolvedTone]);
	const showStripe = resolvedColor !== undefined;

	// Module variant keeps a full border (the stripe overlays the border via
	// z-index). Default / compact replace the top border with the stripe so it
	// sits flush on the card edge. Surface uses the muted soft-hairline.
	const borderClass = isSurface
		? "border border-soft-hairline/60"
		: isModule
			? "border border-soft-hairline"
			: showStripe
				? "border-l border-r border-b border-soft-hairline"
				: "border border-soft-hairline";

	const stripeHeight = stripeWeight === "hairline" ? "h-px" : "h-0.5";
	const stripePosition = isModule
		? `absolute inset-x-0 top-0 z-10 ${stripeHeight}`
		: `absolute top-0 -left-px -right-px ${stripeHeight}`;

	return (
		<Element
			ref={ref}
			className={[
				"relative rounded-xs overflow-hidden",
				isSurface ? "bg-cream-inset" : "bg-warm-paper-raised",
				borderClass,
				padding,
				className,
			].join(" ")}
			{...rest}
		>
			{showStripe && (
				<span
					aria-hidden="true"
					className={stripePosition}
					style={{ backgroundColor: resolvedColor }}
				/>
			)}
			{children}
		</Element>
	);
}

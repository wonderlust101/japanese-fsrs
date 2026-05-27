/**
 * Smooth-curve path builders for the Insights line charts. Uses a
 * Catmull-Rom-to-Cubic-Bezier conversion: each segment's control points
 * are derived from the neighbouring points, producing a continuous curve
 * that passes through every data point without overshoot.
 *
 * Two flavors:
 *
 *   - `smoothLinePath(points)` — for charts without gaps. Returns a
 *     single `M ... C ... C ...` path.
 *   - `smoothLinePathWithGaps(points)` — for charts that may have `null`
 *     entries (e.g. retention curves with inactive days). Splits into
 *     continuous runs, smooths each run, and rejoins with `M` commands.
 *
 * Plus matching area path helpers that close back to a baseline.
 */

export type Pt = readonly [number, number];

/** Smooth a single continuous run of points using Catmull-Rom → Cubic Bezier. */
export function smoothLinePath(points: ReadonlyArray<Pt>): string {
	if (points.length === 0)
		return "";
	const first = points[0];
	if (first === undefined)
		return "";
	if (points.length === 1) {
		return `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
	}

	const out: string[] = [];
	out.push(`M${first[0].toFixed(2)} ${first[1].toFixed(2)}`);

	for (let i = 0; i < points.length - 1; i += 1) {
		const p0 = points[i - 1] ?? points[i] as Pt;
		const p1 = points[i] as Pt;
		const p2 = points[i + 1] as Pt;
		const p3 = points[i + 2] ?? points[i + 1] as Pt;

		// Catmull-Rom tension = 0.5 (default Catmull-Rom curve).
		const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
		const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
		const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
		const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

		out.push(
			`C${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, `
			+ `${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, `
			+ `${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`,
		);
	}

	return out.join(" ");
}

/**
 * Smooth a series that may contain `null` gaps. Splits into runs of
 *  consecutive non-null points and smooths each independently.
 */
export function smoothLinePathWithGaps(points: ReadonlyArray<Pt | null>): string {
	const runs: Pt[][] = [];
	let current: Pt[] = [];
	for (const p of points) {
		if (p === null) {
			if (current.length > 0) {
				runs.push(current);
				current = [];
			}
		} else {
			current.push(p);
		}
	}
	if (current.length > 0)
		runs.push(current);
	return runs.map(r => smoothLinePath(r)).filter(s => s.length > 0).join(" ");
}

/** Build an area path from a smooth line, closing back to a baseline Y. */
export function smoothAreaPath(points: ReadonlyArray<Pt>, baseY: number): string | null {
	if (points.length < 2)
		return null;
	const first = points[0];
	const last = points[points.length - 1];
	if (first === undefined || last === undefined)
		return null;
	const line = smoothLinePath(points);
	return `${line} L${last[0].toFixed(2)} ${baseY.toFixed(2)} L${first[0].toFixed(2)} ${baseY.toFixed(2)} Z`;
}

/**
 * Area path for a series with gaps. Each continuous run becomes its own
 *  closed sub-area.
 */
export function smoothAreaPathWithGaps(
	points: ReadonlyArray<Pt | null>,
	baseY: number,
): string | null {
	const runs: Pt[][] = [];
	let current: Pt[] = [];
	for (const p of points) {
		if (p === null) {
			if (current.length >= 2)
				runs.push(current);
			current = [];
		} else {
			current.push(p);
		}
	}
	if (current.length >= 2)
		runs.push(current);
	if (runs.length === 0)
		return null;

	const areas = runs.map(r => smoothAreaPath(r, baseY)).filter((s): s is string => s !== null);
	if (areas.length === 0)
		return null;
	return areas.join(" ");
}

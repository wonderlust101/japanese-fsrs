export * from "./dates";
export * from "./paths";
/**
 * Shared chart toolkit for the Insights surfaces (overview, forecast,
 * progress, statistics). Promoted out of `insights/_components` so the
 * subtrees stop reaching through `../../_components/*` relative paths and
 * consume one stable module instead.
 *
 * - `primitives`  — SVG axis text, focal dot, reference line, figcaption,
 *                   legend swatch, plus the shared ink/size tokens.
 * - `ScrollableChartFrame` — the horizontal-scroll wrapper every wide chart
 *                   uses to stay legible on narrow viewports.
 * - `paths`       — smoothed line/area path math (`smoothLinePath`, …).
 * - `dates`       — chart date-axis helpers.
 */
export * from "./primitives";
export { ScrollableChartFrame } from "./ScrollableChartFrame";
export { type HeatmapDay, YearHeatmap } from "./YearHeatmap";

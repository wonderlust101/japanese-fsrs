/**
 * Aggregate line-coverage gate (audit M3, 2026-05-29).
 *
 * bun 1.3.14's built-in `coverageThreshold` is unusable for an aggregate gate:
 * the object form is silently ignored, and the single-number form is applied
 * per file — so any 0%-covered file (the type-only shared-types modules are
 * pulled in transitively) fails every positive floor. We compute the weighted
 * aggregate line coverage from the lcov report instead. That is also the honest
 * "fraction of lines covered" figure: bun's text "All files" row is an
 * unweighted mean of per-file percentages and reads several points higher.
 *
 * Reads `coverage/lcov.info` (produced by `bun run test:coverage`) and exits
 * non-zero when aggregate line coverage is below FLOOR. Raise FLOOR as coverage
 * improves. Override for experiments with `COVERAGE_FLOOR=<pct>`.
 */
import { readFileSync } from "node:fs";

const FLOOR = Number(process.env.COVERAGE_FLOOR ?? "65");
const lcovPath = process.argv[2] ?? "coverage/lcov.info";

let report: string;
try {
	report = readFileSync(lcovPath, "utf8");
} catch {
	console.error(`::error::coverage report not found at ${lcovPath} — run \`bun run test:coverage\` first`);
	process.exit(1);
}

// lcov emits per-file `LF:` (lines found) and `LH:` (lines hit) records; summing
// them gives a size-weighted aggregate rather than a mean of per-file ratios.
let linesFound = 0;
let linesHit = 0;
for (const line of report.split("\n")) {
	if (line.startsWith("LF:"))
		linesFound += Number(line.slice(3));
	else if (line.startsWith("LH:"))
		linesHit += Number(line.slice(3));
}

if (linesFound === 0) {
	console.error(`::error::no line-coverage records found in ${lcovPath}`);
	process.exit(1);
}

const pct = (100 * linesHit) / linesFound;
console.log(`API aggregate line coverage: ${pct.toFixed(2)}%  (floor ${FLOOR}%)`);

if (pct < FLOOR) {
	console.error(`::error::API line coverage ${pct.toFixed(2)}% is below the ${FLOOR}% floor`);
	process.exit(1);
}

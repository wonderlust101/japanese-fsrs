"use client";

// Development-only structured error panel (modeled on the Next.js dev
// overlay) plus the shared Markdown report builder. Lifted out of
// page-state.tsx and re-exported from there, so the error / not-found
// pages keep a single import site.

import { useState } from "react";

import { CopyButton } from "@/components/ui/CopyButton";
import { useCopyConfirmation } from "@/hooks/use-copy-confirmation";
import { currentDate } from "@/lib/runtime";

interface DevPanelProps {
	/**
	 * In production this component renders nothing. The check happens inside
	 * the component so callers can keep markup flat; tree-shaking will drop
	 * the body for prod builds when NODE_ENV is statically known.
	 *
	 * The `| undefined` widening on each field matches the project's pattern
	 * (see DueQueue in today-hero.tsx). With `exactOptionalPropertyTypes`
	 * on, callers can pass `digest: error.digest` directly even when the
	 * underlying `error.digest` is itself `string | undefined`.
	 */
	error?: {
		name?: string | undefined;
		message?: string | undefined;
		digest?: string | undefined;
		stack?: string | undefined;
	} | undefined;
	pathname?: string | undefined;
	/**
	 * Optional referrer string (only meaningful on 404, where the user's
	 * previous page is informative). Omitted entirely from the dev panel
	 * if not provided.
	 */
	referrer?: string | undefined;
}

/**
 * Development-only structured error panel modeled after Next.js's dev
 * overlay: labeled fields (Name, Message, Digest, Route, Time, Browser)
 * and the full stack trace, all in JetBrains Mono. Two copy affordances —
 * "Copy all" copies a structured Markdown block (paste-friendly into
 * GitHub issues, Discord, email) and "Copy stack" copies only the stack
 * trace. Both buttons morph to "✓ Copied" for 1500ms after click.
 *
 * Expanded by default so the developer sees the error without an extra
 * click. The chevron at top-right collapses to a one-line summary.
 *
 * In production this component renders `null` and disappears from the
 * output. The "Report this" button (defined separately) covers the
 * production reporting channel.
 */
export function DevPanel({ error, pathname, referrer }: DevPanelProps): React.JSX.Element | null {
	const [expanded, setExpanded] = useState(true);
	const { copied: copiedAll, copy: copyAll } = useCopyConfirmation();
	const { copied: copiedStack, copy: copyStack } = useCopyConfirmation();

	// The check is intentionally inside render so the component is safe to
	// import unconditionally. Webpack drops the body for prod bundles.
	if (process.env.NODE_ENV !== "development") {
		return null;
	}

	const time = currentDate().toISOString();
	const browser = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";

	const fields: { label: string; value: string }[] = [
		...(error?.name !== undefined ? [{ label: "Name", value: error.name }] : []),
		...(error?.message !== undefined ? [{ label: "Message", value: error.message }] : []),
		...(error?.digest !== undefined ? [{ label: "Digest", value: error.digest }] : []),
		...(pathname !== undefined ? [{ label: "Route", value: pathname }] : []),
		...(referrer !== undefined ? [{ label: "Referrer", value: referrer }] : []),
		{ label: "Time", value: time },
		{ label: "Browser", value: browser },
	];

	const markdownPayload = buildMarkdownReport({
		name: error?.name,
		message: error?.message,
		digest: error?.digest,
		stack: error?.stack,
		pathname,
		referrer,
		time,
		browser,
	});

	return (
		<section
			aria-label="Developer information"
			className={[
				"mt-10 w-full rounded-xs border border-soft-hairline bg-cream-inset/60",
				"text-left",
			].join(" ")}
		>
			<header className="flex items-center justify-between gap-3 border-b border-soft-hairline px-4 py-2.5">
				<p className="font-mono text-sm text-faded-sumi">
					Development info
				</p>
				<div className="flex items-center gap-2">
					<CopyButton
						onClick={() => copyAll(markdownPayload)}
						copied={copiedAll}
						label="Copy all"
					/>
					<button
						type="button"
						onClick={() => setExpanded(v => !v)}
						aria-expanded={expanded}
						aria-label={expanded ? "Collapse developer info" : "Expand developer info"}
						className="inline-flex h-7 w-7 items-center justify-center rounded-xs text-faded-sumi transition-colors hover:bg-warm-paper-raised hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 12 12"
							aria-hidden="true"
							className={["transition-transform", expanded ? "" : "-rotate-90"].join(" ")}
						>
							<path d="M2 4 L 6 8 L 10 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
						</svg>
					</button>
				</div>
			</header>

			{expanded && (
				<div className="px-4 py-3">
					<dl className="grid grid-cols-[7rem_1fr] gap-y-2 font-mono text-xs leading-relaxed">
						{fields.map(f => (
							<DevField key={f.label} label={f.label} value={f.value} />
						))}
					</dl>

					{error?.stack !== undefined && (
						<div className="mt-4 border-t border-soft-hairline pt-3">
							<div className="flex items-center justify-between gap-3">
								<p className="font-mono text-sm text-faded-sumi">
									Stack
								</p>
								<CopyButton
									onClick={() => copyStack(error.stack ?? "")}
									copied={copiedStack}
									label="Copy stack"
								/>
							</div>
							<pre
								className={[
									"mt-2 max-h-80 overflow-auto rounded-xs bg-warm-paper-raised",
									"p-3 font-mono text-sm leading-relaxed text-sumi-ink",
									"whitespace-pre",
								].join(" ")}
							>
								{error.stack}
							</pre>
						</div>
					)}
				</div>
			)}
		</section>
	);
}

function DevField({ label, value }: { label: string; value: string }): React.JSX.Element {
	return (
		<>
			<dt className="text-sm text-faded-sumi">
				{label}
			</dt>
			<dd className="min-w-0 break-words text-sumi-ink">
				{value}
			</dd>
		</>
	);
}

// CopyButton (the "morph to ✓ Copied" mono chip) now lives in
// `@/components/ui/CopyButton` and is shared with the dev tooling.

interface ReportPayload {
	name?: string | undefined;
	message?: string | undefined;
	digest?: string | undefined;
	stack?: string | undefined;
	pathname?: string | undefined;
	referrer?: string | undefined;
	time?: string | undefined;
	browser?: string | undefined;
}

/**
 * Builds the paste-friendly Markdown block that the dev panel "Copy all"
 * button and the production "Report this" button both produce. Format
 * mirrors a GitHub issue template: front-matter style fields, then a
 * fenced code block for the stack when present.
 *
 * In production callers omit `stack` (server-side only, unsafe to surface
 * to clients); the function gracefully omits the code block in that case.
 */
export function buildMarkdownReport(p: ReportPayload): string {
	const lines: string[] = ["**Tomo error**", ""];
	if (p.digest !== undefined)
		lines.push(`- Digest: \`${p.digest}\``);
	if (p.pathname !== undefined)
		lines.push(`- Route: \`${p.pathname}\``);
	if (p.referrer !== undefined)
		lines.push(`- Referrer: \`${p.referrer}\``);
	if (p.time !== undefined)
		lines.push(`- Time: ${p.time}`);
	if (p.browser !== undefined)
		lines.push(`- Browser: ${p.browser}`);
	if (p.name !== undefined)
		lines.push(`- Name: \`${p.name}\``);
	if (p.message !== undefined)
		lines.push(`- Message: ${p.message}`);
	if (p.stack !== undefined) {
		lines.push("", "```", p.stack, "```");
	}
	return lines.join("\n");
}

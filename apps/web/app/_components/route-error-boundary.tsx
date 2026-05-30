"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCopyConfirmation } from "@/hooks/use-copy-confirmation";
import { reportError } from "@/lib/report-error";

import {
	buildMarkdownReport,
	DevPanel,
	EmptyPathVisual,
	FullReloadHint,
	HeroKicker,
	IdentityStrip,
	InlinePath,
	InlinePathsRow,
	PageBody,
	PageHeadline,
	PageStateFrame,
	PrimaryAction,
	VisualSlot,
} from "./page-state";

/**
 * Shared route-segment error boundary.
 *
 * Next.js requires every `error.tsx` to be a Client Component whose default
 * export receives `{ error, reset }`. The behaviour those boundaries share —
 * soft-retry escalation, error reporting, and the page-state composition — lives
 * here so each route group's `error.tsx` is a thin config wrapper instead of a
 * ~130-line near-duplicate. (The root and `(app)` boundaries predate this and
 * still inline the same logic; they can adopt this component in a follow-up.)
 *
 * `variant` MUST match the parent layout: route groups whose `layout.tsx`
 * already renders a `<main>` (`(auth)`, `(marketing)`, `(app)`) pass `inshell`,
 * because `fullbleed` renders its own `<main>` and nesting `<main>` elements is
 * invalid HTML and a duplicate landmark. Only the root boundary — rendered by a
 * layout with no `<main>` — uses `fullbleed`.
 *
 * `backHref` / `backLabel` are optional: shell-less full-bleed contexts offer a
 * path back to a safe landmark; the in-shell `(app)` boundary omits it because
 * the sidebar already carries navigation.
 */
interface RouteErrorBoundaryProps {
	error: Error & { digest?: string };
	reset: () => void;
	variant: "fullbleed" | "inshell";
	/** Tagged on the reported error so logs name the originating boundary. */
	source: string;
	backHref?: string;
	backLabel?: string;
}

/**
 * Retry counter persists across re-mounts via sessionStorage, keyed by
 * `error.digest`. Next.js unmounts the boundary when `reset()` re-renders its
 * children and re-mounts a fresh instance if the error fires again — which
 * would reset `useState(0)` and prevent the soft-retry escalation from ever
 * triggering. Degrades silently when storage is unavailable.
 */
function readRetryCount(digest: string | undefined): number {
	if (typeof sessionStorage === "undefined")
		return 0;
	const raw = sessionStorage.getItem(`tomo.error.retries.${digest ?? "unknown"}`);
	const n = Number(raw ?? "0");
	return Number.isFinite(n) ? n : 0;
}

function writeRetryCount(digest: string | undefined, count: number): void {
	if (typeof sessionStorage === "undefined")
		return;
	sessionStorage.setItem(`tomo.error.retries.${digest ?? "unknown"}`, String(count));
}

export function RouteErrorBoundary({
	error,
	reset,
	variant,
	source,
	backHref,
	backLabel,
}: RouteErrorBoundaryProps): React.JSX.Element {
	const pathname = usePathname();
	const [retries, setRetries] = useState<number>(() => readRetryCount(error.digest));
	const { copied: reported, copy: copyReport } = useCopyConfirmation();

	useEffect(() => {
		reportError(error, { source, pathname, digest: error.digest });
	}, [error, pathname, source]);

	function handleRetry(): void {
		const next = retries + 1;
		setRetries(next);
		writeRetryCount(error.digest, next);
		reset();
	}

	function handleFullReload(): void {
		if (typeof window !== "undefined") {
			window.location.reload();
		}
	}

	function handleReport(): void {
		// Production payload omits name + stack: deployed stacks are minified to
		// the point of being unhelpful, and the digest is what server logs key on.
		// The dev panel below still carries the full stack for local repros.
		const isDev = process.env.NODE_ENV === "development";
		const payload = buildMarkdownReport({
			name: isDev ? error.name : undefined,
			message: error.message,
			digest: error.digest,
			stack: isDev ? error.stack : undefined,
			pathname,
			time: new Date().toISOString(),
			browser: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
		});
		copyReport(payload);
	}

	return (
		<PageStateFrame variant={variant}>
			<IdentityStrip tone="error" />
			<HeroKicker kanji="復" label="Practice paused" tone="error" />
			<VisualSlot>
				<EmptyPathVisual kanji="復" label="Practice paused" tone="error" />
			</VisualSlot>
			<PageHeadline tone="error">
				Something went wrong loading this page.
			</PageHeadline>
			<PageBody>Nothing on the schedule has changed.</PageBody>
			<PrimaryAction tone="error" onClick={handleRetry}>
				Try again
			</PrimaryAction>
			<InlinePathsRow>
				{backHref !== undefined && (
					<InlinePath href={backHref}>{backLabel ?? "Back"}</InlinePath>
				)}
				<InlinePath onClick={handleReport}>
					{reported ? "Copied" : "Report this"}
				</InlinePath>
			</InlinePathsRow>
			{retries >= 2 && <FullReloadHint onClick={handleFullReload} />}
			<DevPanel
				error={{
					name: error.name,
					message: error.message,
					digest: error.digest,
					stack: error.stack,
				}}
				pathname={pathname}
			/>
		</PageStateFrame>
	);
}

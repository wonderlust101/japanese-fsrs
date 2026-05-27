"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/report-error";

/**
 * Last-resort fallback. Next.js renders this when the root error boundary
 * (`app/error.tsx`) itself throws, or when the root layout fails during
 * render. Because it replaces the root layout entirely, this file:
 *
 *  - MUST own its own `<html>` and `<body>` tags.
 *  - Cannot rely on the root layout's font setup or QueryProvider context.
 *  - Should not import components that could be the source of the failure
 *    (Logo loads an Image, page-state.tsx pulls Motion + Link); inlining
 *    everything keeps the file dependency-free.
 *
 * Inline styles use the brand hex values directly so the surface is still
 * recognizable as Tomo even if the global stylesheet failed to load (the
 * usual reason the root boundary itself crashes is a CSS / build asset
 * failure). The kicker, headline, and reload button are all that lives
 * here: when you've reached this surface, the user needs one path back,
 * not three.
 */

interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

const COLORS = {
	page: "#F4F1EC", // cool-paper-base
	card: "#FDFBF7", // warm-paper-raised
	border: "#E5DCD0", // soft-hairline
	ink: "#1F1A18", // sumi-ink
	faded: "#6B5F58", // faded-sumi
	vermillion: "#B03646", // inari-vermillion
	errorDeep: "#7F1D1D", // error-deep
} as const;

export default function GlobalError({ error, reset }: GlobalErrorProps): React.JSX.Element {
	useEffect(() => {
		reportError(error, { source: "global error boundary", digest: error.digest });
	}, [error]);

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "2rem 1rem",
					backgroundColor: COLORS.page,
					fontFamily: "system-ui, -apple-system, \"DM Sans\", sans-serif",
					color: COLORS.ink,
				}}
			>
				<section
					role="alert"
					aria-live="assertive"
					style={{
						position: "relative",
						width: "100%",
						maxWidth: "480px",
						backgroundColor: COLORS.card,
						border: `1px solid ${COLORS.border}`,
						borderRadius: "2px",
						padding: "2.5rem 2rem",
						textAlign: "center",
					}}
				>
					<span
						aria-hidden="true"
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							height: "2px",
							backgroundColor: COLORS.vermillion,
						}}
					/>

					<p
						style={{
							margin: 0,
							display: "flex",
							alignItems: "baseline",
							justifyContent: "center",
							gap: "0.85rem",
						}}
					>
						<span
							lang="ja"
							aria-hidden="true"
							style={{
								fontSize: "1.75rem",
								lineHeight: 1,
								color: COLORS.errorDeep,
							}}
						>
							復
						</span>
						<span
							style={{
								fontFamily: "ui-monospace, \"JetBrains Mono\", monospace",
								fontSize: "0.8125rem",
								fontWeight: 500,
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								color: COLORS.errorDeep,
								opacity: 0.85,
							}}
						>
							Practice paused
						</span>
					</p>

					<hr
						style={{
							border: 0,
							borderTop: `1px solid ${COLORS.border}`,
							margin: "1rem 0 0 0",
						}}
					/>

					<h1
						style={{
							margin: "1.5rem 0 0 0",
							fontSize: "1.5rem",
							lineHeight: 1.15,
							fontWeight: 500,
							color: COLORS.errorDeep,
						}}
					>
						Something gave way.
					</h1>

					<p
						style={{
							margin: "0.75rem auto 0 auto",
							maxWidth: "36ch",
							fontSize: "1rem",
							lineHeight: 1.55,
							color: COLORS.faded,
						}}
					>
						Your decks and progress are safe. Reload to continue.
					</p>

					<div style={{ marginTop: "2rem" }}>
						<button
							type="button"
							onClick={reset}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "0.6rem",
								minHeight: "3rem",
								minWidth: "14rem",
								padding: "0.75rem 2rem",
								border: "none",
								borderRadius: "2px",
								cursor: "pointer",
								backgroundColor: COLORS.errorDeep,
								color: COLORS.card,
								fontSize: "1rem",
								fontWeight: 600,
								fontFamily: "inherit",
							}}
						>
							Reload Tomo
						</button>
					</div>

					{error.digest !== undefined && (
						<p
							style={{
								margin: "1.5rem 0 0 0",
								fontFamily: "ui-monospace, \"JetBrains Mono\", monospace",
								fontSize: "0.6875rem",
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: COLORS.faded,
								opacity: 0.7,
							}}
						>
							Digest:
							{" "}
							{error.digest}
						</p>
					)}
				</section>
			</body>
		</html>
	);
}

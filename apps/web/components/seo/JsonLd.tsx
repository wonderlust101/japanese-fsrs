import { headers } from "next/headers";

/**
 * Renders a single JSON-LD structured-data block. Server-component only — it
 * just emits a `<script>` tag, no hooks.
 *
 * All content passed here is author-controlled (brand copy, FAQ text), never
 * user input, so `dangerouslySetInnerHTML` is safe. We still escape `<` to
 * `<` defensively so a literal `</script>` in any future copy can never
 * break out of the script element.
 *
 * The CSP nonce (minted per request in `middleware.ts`, exposed via the
 * `x-nonce` request header) is stamped onto the tag so the strict
 * `script-src` policy admits it. Reading `headers()` makes this async; the
 * marketing pages that render it are already dynamic under the nonce policy,
 * so there's no extra rendering cost.
 */
export async function JsonLd({
	schema,
}: {
	schema: Record<string, unknown> | Record<string, unknown>[];
}): Promise<React.JSX.Element> {
	const nonce = (await headers()).get("x-nonce") ?? undefined;
	const json = JSON.stringify(schema).replace(/</g, "\\u003c");
	// eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- author-controlled JSON-LD; `<` escaped above so a literal </script> cannot break out (see header).
	return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

// ── Schema builders ─────────────────────────────────────────────────────────
// Typed factories for the schema.org shapes Tomo emits. Each returns a plain
// object; compose several into one `<JsonLd>` via an array (rendered as a
// `@graph`-style list of independent nodes is also valid, but Google reads a
// top-level array fine).

/** The brand entity. Logo points at the full kitsune + 友 mark. */
export function organizationSchema(siteUrl: string): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		"name": "Tomo",
		"url": siteUrl,
		"logo": `${siteUrl}/brand/icon-512.png`,
		"description":
      "Tomo is a spaced-repetition practice app built specifically for Japanese learners.",
	};
}

/**
 * The product itself. Intentionally omits `offers` / price: per PRODUCT.md the
 * product says nothing about Free vs Paid, and that stance extends to
 * structured data — we do not signal a price here.
 */
export function webApplicationSchema(siteUrl: string, description: string): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "Tomo",
		"url": siteUrl,
		"applicationCategory": "EducationalApplication",
		"operatingSystem": "Web",
		"inLanguage": "en",
		description,
	};
}

export interface FaqItem {
	question: string;
	answer: string;
}

/** FAQPage rich-result schema, built from the same Q&A the page renders. */
export function faqPageSchema(items: readonly FaqItem[]): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": items.map(item => ({
			"@type": "Question",
			"name": item.question,
			"acceptedAnswer": { "@type": "Answer", "text": item.answer },
		})),
	};
}

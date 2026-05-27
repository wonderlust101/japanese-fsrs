// Browser-safe UUID v4 generator.
//
// `crypto.randomUUID()` requires a secure context (HTTPS or localhost), so it
// throws when the dev server is reached over LAN HTTP (e.g.
// http://192.168.1.42:3000). `crypto.getRandomValues()` has no such
// restriction, so we fall back to building an RFC 4122 v4 UUID by hand with
// the same entropy source.
//
// Used for client-side identifiers that don't carry cryptographic guarantees
// (session IDs, idempotency keys). Never use this for auth tokens or signing.

export function randomUUID(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		// RFC 4122 §4.4: set version to 4 and the high bits of clock_seq_hi to 10.
		bytes[6] = ((bytes[6] ?? 0) & 0x0F) | 0x40;
		bytes[8] = ((bytes[8] ?? 0) & 0x3F) | 0x80;
		const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0"));
		return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
	}

	// No Web Crypto at all. Acceptable only because callers use this for
	// non-security identifiers (session/idempotency keys).
	const r = (): string => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
	return `${r()}${r()}-${r()}-4${r().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}

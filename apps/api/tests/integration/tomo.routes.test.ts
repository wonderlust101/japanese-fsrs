import { afterAll, beforeAll, expect, it } from "bun:test";
import request from "supertest";

import { describeIntegration, isIntegrationEnabled, signInUser } from "./_helpers";

let app: import("express").Express;
let supabaseAdmin: import("@supabase/supabase-js").SupabaseClient;

interface SeededUser { userId: string; jwt: string }

const seeded: SeededUser[] = [];

async function seedUser(): Promise<SeededUser> {
	const email = `it-tomo-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`;
	const created = await supabaseAdmin.auth.admin.createUser({
		email,
		password: "integration-pass",
		email_confirm: true,
	});
	if (created.error !== null || created.data.user === null)
		throw new Error(`createUser failed: ${created.error?.message}`);
	const userId = created.data.user.id;

	// Mint the JWT on a dedicated auth client so supabaseAdmin stays service_role
	// (see signInUser). Signing in on the shared client leaks the user session.
	const jwt = await signInUser(email);

	return { userId, jwt };
}

beforeAll(async () => {
	if (!isIntegrationEnabled()) {
		return
		;
	}({ app } = await import("../../src/app"))
	;({ supabaseAdmin } = await import("../../src/db/supabase"));
});

afterAll(async () => {
	if (!isIntegrationEnabled())
		return;
	for (const u of seeded) {
		await supabaseAdmin.auth.admin.deleteUser(u.userId).catch(() => undefined);
	}
});

// Backend Completion Plan Stage 6 — Tomo daily note API. Pins the wire
// contract and the cache-stability invariant. Forcing the chat breaker open
// to assert the idiom fallback path requires Redis access plumbed through
// the integration harness, which lives outside this test's scope; the
// idiom-pick logic is unit-tested separately (pure helper).
describeIntegration("tomo routes — daily note wire contract", () => {
	it("GET /api/v1/tomo/note returns body + kind + dateKey on first call", async () => {
		const u = await seedUser(); seeded.push(u);

		const res = await request(app)
			.get("/api/v1/tomo/note")
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(res.status).toBe(200);

		expect(typeof res.body.body).toBe("string");
		expect(res.body.body.length).toBeGreaterThan(0);
		expect(["insight", "idiom"]).toContain(res.body.kind);
		expect(res.body.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("two same-day requests for the same user return identical bodies (cache hit)", async () => {
		const u = await seedUser(); seeded.push(u);

		const first = await request(app)
			.get("/api/v1/tomo/note")
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(first.status).toBe(200);

		const second = await request(app)
			.get("/api/v1/tomo/note")
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(second.status).toBe(200);

		// The server caches per (userId, dateKey, prompt-version). On the same
		// calendar day for the same user, the two responses must match
		// byte-for-byte on body / kind / dateKey. Even if the breaker is open
		// and the idiom fallback fires, the (userId, dateKey)-hash pick is
		// deterministic, so the body is stable.
		expect(second.body.body).toBe(first.body.body);
		expect(second.body.kind).toBe(first.body.kind);
		expect(second.body.dateKey).toBe(first.body.dateKey);
	});

	it("rejects an unauthenticated request with 401", async () => {
		const res = await request(app).get("/api/v1/tomo/note");
		expect(res.status).toBe(401);
	});
});

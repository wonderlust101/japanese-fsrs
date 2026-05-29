import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "bun:test";
import request from "supertest";

import { describeIntegration, isIntegrationEnabled, signInUser } from "./_helpers";

// ─── Regression guard for the dropped-column RPC bugs (migration 20260708000000) ─
//
// `create_weak_spot_drill_session` and `get_weak_spot_drill_session` once read the
// dropped `cards.card_type` column, and `copy_card` once inserted into the dropped
// `cards.tags` column. All three are LANGUAGE plpgsql, so a stale column reference
// is invisible until the function actually executes — the mocked unit tier
// (`src/services/__tests__/weak-spot.service.test.ts`) cannot catch it because it
// never runs the SQL. This tier hits the real migrated DB, so any reintroduced
// `c.card_type` / `tags` reference resurfaces as a 500 here rather than in prod.

let app: import("express").Express;
let supabaseAdmin: import("@supabase/supabase-js").SupabaseClient;

interface SeededUser { userId: string; jwt: string; deckId: string }

const seeded: SeededUser[] = [];

async function seedUser(): Promise<SeededUser> {
	const email = `it-weakspots-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`;
	const created = await supabaseAdmin.auth.admin.createUser({
		email,
		password: "integration-pass",
		email_confirm: true,
	});
	if (created.error !== null || created.data.user === null)
		throw new Error(`createUser failed: ${created.error?.message}`);
	const userId = created.data.user.id;

	// Dedicated-client sign-in keeps supabaseAdmin service_role (see signInUser).
	const jwt = await signInUser(email);

	const deckRes = await request(app)
		.post("/api/v1/decks")
		.set("Authorization", `Bearer ${jwt}`)
		.set("Idempotency-Key", randomUUID())
		.send({ name: "Weak-spot Drill Deck", deckType: "vocabulary" });
	if (deckRes.status !== 201)
		throw new Error(`createDeck failed: ${deckRes.status}`);

	return { userId, jwt, deckId: deckRes.body.id };
}

async function createCard(u: SeededUser): Promise<string> {
	const res = await request(app)
		.post(`/api/v1/decks/${u.deckId}/cards`)
		.set("Authorization", `Bearer ${u.jwt}`)
		.set("Idempotency-Key", randomUUID())
		.send({
			mode: "manual",
			fieldsData: { word: "猫", reading: "ねこ", meaning: "cat" },
			layoutType: "vocabulary",
		});
	if (res.status !== 201)
		throw new Error(`createCard failed: ${res.status} ${JSON.stringify(res.body)}`);
	return res.body.id as string;
}

beforeAll(async () => {
	if (!isIntegrationEnabled())
		return;
	({ app } = await import("../../src/app"));
	({ supabaseAdmin } = await import("../../src/db/supabase"));
});

afterAll(async () => {
	if (!isIntegrationEnabled())
		return;
	for (const u of seeded)
		await supabaseAdmin.auth.admin.deleteUser(u.userId).catch(() => undefined);
});

describeIntegration("weak-spot drill + card copy — real-DB RPC guard", () => {
	it("creates a manualSelection drill session (would 500 if create RPC still read card_type)", async () => {
		const u = await seedUser(); seeded.push(u);
		const cardId = await createCard(u);

		const res = await request(app)
			.post("/api/v1/weak-spots/drill-sessions")
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID())
			.send({ source: "manualSelection", cardIds: [cardId] });

		// The guard: a card_type reference makes this 500 (SQLSTATE 42703).
		expect(res.status).toBe(201);
		expect(Array.isArray(res.body.cards)).toBe(true);
		expect(res.body.cards).toHaveLength(1);

		const card = res.body.cards[0];
		expect(card.cardId).toBe(cardId);
		// A freshly created card has no open weak spot, so manualSelection yields
		// weakSpotId = null — the nullable wire-contract that shipped with the fix.
		expect(card.weakSpotId).toBeNull();
	});

	it("fetches (resumes) a drill session (would 500 if get RPC still read card_type)", async () => {
		const u = await seedUser(); seeded.push(u);
		const cardId = await createCard(u);

		const createRes = await request(app)
			.post("/api/v1/weak-spots/drill-sessions")
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID())
			.send({ source: "manualSelection", cardIds: [cardId] });
		expect(createRes.status).toBe(201);
		const sessionId = createRes.body.sessionId as string;

		const getRes = await request(app)
			.get(`/api/v1/weak-spots/drill-sessions/${sessionId}`)
			.set("Authorization", `Bearer ${u.jwt}`);

		expect(getRes.status).toBe(200);
		expect(getRes.body.sessionId).toBe(sessionId);
		expect(getRes.body.cards).toHaveLength(1);
		expect(getRes.body.cards[0].cardId).toBe(cardId);
		expect(getRes.body.cards[0].isOrphaned).toBe(false);
	});

	it("copies a card (would 500 if copy_card still inserted the tags column)", async () => {
		const u = await seedUser(); seeded.push(u);
		const cardId = await createCard(u);

		const res = await request(app)
			.post(`/api/v1/cards/${cardId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID())
			.send({ deckId: u.deckId });

		// The guard: a `tags` column reference makes this 500 (SQLSTATE 42703).
		expect([200, 201]).toContain(res.status);
		expect(res.body.id).toBeDefined();
		expect(res.body.id).not.toBe(cardId);
	});
});

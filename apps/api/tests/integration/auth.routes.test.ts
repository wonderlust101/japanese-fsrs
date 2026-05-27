import { afterAll, beforeAll, expect, it } from "bun:test";
import request from "supertest";

import { describeIntegration, isIntegrationEnabled } from "./_helpers";

// Lazy imports — only resolved when integration tests are enabled, since the
// real Supabase admin client throws at module-load when given the stub URL.
// supertest is import-time safe and stays at the top.
let app: import("express").Express;
let supabaseAdmin: import("@supabase/supabase-js").SupabaseClient;

const createdUserIds: string[] = [];

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
	for (const id of createdUserIds) {
		await supabaseAdmin.auth.admin.deleteUser(id).catch(() => undefined);
	}
});

describeIntegration("POST /api/v1/auth — signup → cancel → re-signup", () => {
	it("signs up, cancels, then signs up again successfully", async () => {
		const email = `integration-${Date.now()}@example.test`;

		const first = await request(app)
			.post("/api/v1/auth/signup")
			.send({ email, password: "integration-pass-1", displayName: "Integration User" });
		expect([201, 400]).toContain(first.status);
		if (first.status === 201 && first.body.userId !== null) {
			createdUserIds.push(first.body.userId);
			const cancel = await request(app)
				.post("/api/v1/auth/cancel-signup")
			// cancel-signup now requires the cancellationToken issued at signup
			// (anti-enumeration hardening); userId alone is a 400.
				.send({ userId: first.body.userId, cancellationToken: first.body.cancellationToken });
			expect(cancel.status).toBe(204);
		}

		const second = await request(app)
			.post("/api/v1/auth/signup")
			.send({ email, password: "integration-pass-2", displayName: "Integration User" });
		expect(second.status).toBe(201);
		if (second.body.userId !== null)
			createdUserIds.push(second.body.userId);
	});

	it("returns a generic success shape for duplicate emails (no enumeration leak)", async () => {
		const email = `integration-dup-${Date.now()}@example.test`;

		const first = await request(app)
			.post("/api/v1/auth/signup")
			.send({ email, password: "integration-pass-1", displayName: "Integration User" });
		expect(first.status).toBe(201);
		if (first.body.userId !== null)
			createdUserIds.push(first.body.userId);

		const dup = await request(app)
			.post("/api/v1/auth/signup")
			.send({ email, password: "integration-pass-2", displayName: "Integration User" });
		// The API must not surface a different status / shape for the duplicate
		// path — that would leak account existence to anonymous callers.
		expect(dup.status).toBe(201);
		expect(dup.body).toHaveProperty("email", email);
		expect(dup.body).toHaveProperty("userId");
		// userId is null on the duplicate path; the cancel-signup step is a no-op.
		expect(dup.body.userId).toBeNull();
	});
});

import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createSupabaseHarness } from "../../../tests/support";

// profile.service only touches Supabase (no redis/openai), so one harness
// covers it. The value is the camelCase<->snake_case mapping and the
// 404/412 RPC-error branches. Was ~30% line coverage before (audit M2).
const sb = createSupabaseHarness();
mock.module("../../db/supabase.ts", () => ({ supabaseAdmin: sb.supabaseAdmin }));

const { getProfile, updateProfile } = await import("../profile.service.ts");

function profileRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "u1",
		native_language: "en",
		jlpt_target: "N3",
		study_goal: "travel",
		daily_new_cards_limit: 20,
		daily_review_limit: 200,
		retention_target: 0.85,
		timezone: "Asia/Tokyo",
		version: 1,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-02T00:00:00Z",
		...overrides,
	};
}

beforeEach(() => sb.reset());

describe("getProfile", () => {
	it("maps the row + interests to the camelCase wire shape", async () => {
		sb.state.responses.profiles = [{ data: profileRow(), error: null }];
		sb.state.responses.user_interests = [{ data: [{ interest: "anime" }, { interest: "manga" }], error: null }];

		const out = await getProfile("u1");

		expect(out).toMatchObject({
			id: "u1",
			nativeLanguage: "en",
			jlptTarget: "N3",
			studyGoal: "travel",
			interests: ["anime", "manga"],
			dailyNewCardsLimit: 20,
			dailyReviewLimit: 200,
			retentionTarget: 0.85,
			timezone: "Asia/Tokyo",
			version: 1,
		});
	});

	it("throws 404 when the profile row is missing", async () => {
		sb.state.responses.profiles = [{ data: null, error: { message: "no rows" } }];
		sb.state.responses.user_interests = [{ data: [], error: null }];

		await expect(getProfile("u1")).rejects.toThrow("Profile not found");
	});
});

describe("updateProfile", () => {
	type Input = Parameters<typeof updateProfile>[2];

	it("maps a camelCase patch to snake_case and re-reads on success", async () => {
		sb.state.rpcResponses.update_profile_with_interests = [{ data: null, error: null }];
		sb.state.responses.profiles = [{ data: profileRow({ version: 2, daily_review_limit: 150 }), error: null }];
		sb.state.responses.user_interests = [{ data: [], error: null }];

		const out = await updateProfile("u1", 1, { jlptTarget: "N2", dailyReviewLimit: 150 } as Input);

		expect(out.version).toBe(2);
		const call = sb.state.rpcCalls[0];
		expect(call?.name).toBe("update_profile_with_interests");
		const payload = call?.payload as { p_patch: Record<string, unknown>; p_expected_version: number; p_user_id: string };
		expect(payload.p_patch).toEqual({ jlpt_target: "N2", daily_review_limit: 150 });
		expect(payload.p_expected_version).toBe(1);
		expect(payload.p_user_id).toBe("u1");
	});

	it("maps profile_not_found to 404", async () => {
		sb.state.rpcResponses.update_profile_with_interests = [{ data: null, error: { code: "02000", message: "profile_not_found" } }];

		await expect(updateProfile("u1", 1, { jlptTarget: "N2" } as Input)).rejects.toThrow("Profile not found");
	});

	it("maps a version mismatch to 412", async () => {
		sb.state.rpcResponses.update_profile_with_interests = [{ data: null, error: { code: "22000", message: "profile_version_mismatch" } }];

		await expect(updateProfile("u1", 1, { jlptTarget: "N2" } as Input)).rejects.toThrow(/modified/);
	});

	it("rethrows other RPC errors", async () => {
		sb.state.rpcResponses.update_profile_with_interests = [{ data: null, error: { code: "XX000", message: "boom" } }];

		await expect(updateProfile("u1", 1, { jlptTarget: "N2" } as Input)).rejects.toThrow();
	});
});

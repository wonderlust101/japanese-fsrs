"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/Textarea";
import { TomoSelect } from "@/components/ui/TomoSelect";
import { useSettingsProfileDevState } from "@/dev/panels/settings-profile";

import { updateProfileAction } from "@/lib/actions/profile.actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ContextNote, ContextStrip } from "./context-strip";
import { SectionShell } from "./section-shell";
import { SettingsField } from "./settings-field";
import { useFieldFeedback } from "./use-field-feedback";

const LANGUAGES = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "pt", label: "Portuguese" },
	{ value: "zh", label: "Chinese" },
	{ value: "ko", label: "Korean" },
	{ value: "ru", label: "Russian" },
	{ value: "ja", label: "Japanese" },
] as const;

type LanguageValue = (typeof LANGUAGES)[number]["value"];

interface Props {
	email: string;
	initialDisplayName: string;
	initialNativeLanguage: string;
	initialTimezone: string;
	initialStudyGoal: string;
}

/**
 * Profile section: identity-leaning settings, wrapped in a SectionCard.
 *
 * Two register splits live here per the brief's hybrid-by-sensitivity rule:
 *   Auto-save register:   Native language (TomoSelect; commits on selection).
 *   Explicit-save:        Email, display name, and timezone (commit via the
 *                         section-foot "Save changes" or Enter in any field).
 *
 * Email change uses Supabase's double opt-in: the API call sends a
 * confirmation link to the new address, and the user's effective email
 * doesn't change until they click that link. We surface a persistent
 * "check your inbox" notice under the field after a successful submit so
 * the user doesn't think the change silently failed.
 */
export function ProfileSection({
	email,
	initialDisplayName,
	initialNativeLanguage,
	initialTimezone,
	initialStudyGoal,
}: Props): React.JSX.Element {
	useSettingsProfileDevState();
	const feedback = useFieldFeedback();

	const [emailValue, setEmailValue] = useState(email);
	const [displayName, setDisplayName] = useState(initialDisplayName);
	const [native, setNative] = useState<LanguageValue>(
		isLanguageValue(initialNativeLanguage) ? initialNativeLanguage : "en",
	);
	const [timezone, setTimezone] = useState(initialTimezone);
	const [studyGoal, setStudyGoal] = useState(initialStudyGoal);

	const [committedEmail, setCommittedEmail] = useState(email);
	const [committedDisplayName, setCommittedDisplayName] = useState(initialDisplayName);
	const [committedTimezone, setCommittedTimezone] = useState(initialTimezone);
	const [committedStudyGoal, setCommittedStudyGoal] = useState(initialStudyGoal);

	// Persistent "check your inbox" notice after a successful email submit.
	// Cleared as soon as the user starts editing the field again so a stale
	// notice doesn't linger from a prior submission.
	const [pendingEmailNotice, setPendingEmailNotice] = useState<string | null>(null);

	const [submitting, setSubmitting] = useState(false);

	const emailDirty = emailValue.trim() !== committedEmail;
	const displayNameDirty = displayName.trim() !== committedDisplayName;
	const timezoneDirty = timezone.trim() !== committedTimezone;
	const studyGoalDirty = studyGoal !== committedStudyGoal;
	const formDirty = emailDirty || displayNameDirty || timezoneDirty || studyGoalDirty;

	function handleEmailChange(value: string): void {
		setEmailValue(value);
		// Any keystroke clears a stale "check your inbox" notice from a prior submit.
		if (pendingEmailNotice !== null)
			setPendingEmailNotice(null);
		if (value.trim() !== committedEmail)
			feedback.markDirty("email");
		else feedback.clearDirty("email");
	}

	function handleDisplayNameChange(value: string): void {
		setDisplayName(value);
		if (value.trim() !== committedDisplayName)
			feedback.markDirty("display-name");
		else feedback.clearDirty("display-name");
	}

	function handleTimezoneChange(value: string): void {
		setTimezone(value);
		if (value.trim() !== committedTimezone)
			feedback.markDirty("timezone");
		else feedback.clearDirty("timezone");
	}

	function handleStudyGoalChange(value: string): void {
		setStudyGoal(value);
		if (value !== committedStudyGoal)
			feedback.markDirty("study-goal");
		else feedback.clearDirty("study-goal");
	}

	async function handleNativeChange(value: LanguageValue): Promise<void> {
		const previous = native;
		setNative(value);
		if (value === previous)
			return;
		try {
			await updateProfileAction({ nativeLanguage: value });
			feedback.markSaved("native-language");
		} catch (e) {
			setNative(previous);
			feedback.markError("native-language", e instanceof Error ? e.message : "Could not save.");
		}
	}

	async function submitDirty(): Promise<void> {
		if (!formDirty || submitting)
			return;
		const trimmedEmail = emailValue.trim();
		const trimmedName = displayName.trim();
		const trimmedTz = timezone.trim();

		if (displayNameDirty && trimmedName.length === 0) {
			feedback.markError("display-name", "Display name cannot be empty.");
			return;
		}
		if (emailDirty && !isValidEmail(trimmedEmail)) {
			feedback.markError("email", "Enter a valid email address.");
			return;
		}

		setSubmitting(true);

		type CommitOutcome
			= | { id: string; ok: true }
				| { id: string; ok: false; error: string };
		const tasks: Promise<CommitOutcome>[] = [];

		if (emailDirty) {
			tasks.push((async (): Promise<CommitOutcome> => {
				try {
					const supabase = createSupabaseBrowserClient();
					const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
					if (error !== null) {
						return { id: "email", ok: false, error: friendlyAuthError(error.message) };
					}
					return { id: "email", ok: true };
				} catch (e) {
					return { id: "email", ok: false, error: friendlyAuthError(e instanceof Error ? e.message : undefined) };
				}
			})());
		}

		if (displayNameDirty) {
			tasks.push((async (): Promise<CommitOutcome> => {
				try {
					const supabase = createSupabaseBrowserClient();
					const { error } = await supabase.auth.updateUser({ data: { display_name: trimmedName } });
					if (error !== null) {
						return { id: "display-name", ok: false, error: friendlyAuthError(error.message) };
					}
					return { id: "display-name", ok: true };
				} catch (e) {
					return { id: "display-name", ok: false, error: friendlyAuthError(e instanceof Error ? e.message : undefined) };
				}
			})());
		}

		if (timezoneDirty && trimmedTz.length > 0) {
			tasks.push((async (): Promise<CommitOutcome> => {
				try {
					await updateProfileAction({ timezone: trimmedTz });
					return { id: "timezone", ok: true };
				} catch (e) {
					return { id: "timezone", ok: false, error: e instanceof Error ? e.message : "Could not save." };
				}
			})());
		}

		if (studyGoalDirty) {
			tasks.push((async (): Promise<CommitOutcome> => {
				try {
					await updateProfileAction({ studyGoal });
					return { id: "study-goal", ok: true };
				} catch (e) {
					return { id: "study-goal", ok: false, error: e instanceof Error ? e.message : "Could not save." };
				}
			})());
		}

		const results = await Promise.all(tasks);

		for (const r of results) {
			if (r.ok) {
				feedback.markSaved(r.id);
				if (r.id === "email") {
					setCommittedEmail(trimmedEmail);
					setPendingEmailNotice(
						`We sent a confirmation link to ${trimmedEmail}. Click it to finish updating.`,
					);
				}
				if (r.id === "display-name")
					setCommittedDisplayName(trimmedName);
				if (r.id === "timezone")
					setCommittedTimezone(trimmedTz);
				if (r.id === "study-goal")
					setCommittedStudyGoal(studyGoal);
			} else {
				feedback.markError(r.id, r.error);
			}
		}

		setSubmitting(false);
	}

	function handleEnterCommit(e: React.KeyboardEvent<HTMLInputElement>): void {
		if (e.key === "Enter") {
			e.preventDefault();
			void submitDirty();
		}
	}

	return (
		<SectionShell
			heading="Profile settings"
			strip={(
				<ContextStrip>
					<ContextNote eyebrow="Locale" title="How Tomo reads your day">
						<p>
							Timezone determines when "today" rolls over and when the daily new-card
							budget refreshes. Native language tunes how AI explanations are phrased,
							never the Japanese itself.
						</p>
					</ContextNote>
					<ContextNote eyebrow="Email change">
						<p>
							Updating your sign-in email sends a confirmation link to the new address.
							Your effective email doesn't change until you click that link.
						</p>
					</ContextNote>
					<ContextNote eyebrow="Goal" title="The study goal stays small">
						<p>
							One sentence is plenty. Tomo uses it to flavour example sentences and to
							show on your Today screen on rough mornings.
						</p>
					</ContextNote>
				</ContextStrip>
			)}
		>
			<SectionCard
				id="profile"
				kanji="人"
				label="Account"
				description="How you appear inside Tomo, and the locale your day runs on."
				variant="compact"
			>
				<div className="flex flex-col gap-y-6">
					<SettingsField
						label="Email"
						hint={pendingEmailNotice ?? undefined}
						dirty={feedback.isDirty("email")}
						saved={feedback.isSaved("email")}
						error={feedback.getError("email")}
						htmlFor="settings-email"
					>
						<Input
							id="settings-email"
							type="email"
							value={emailValue}
							onChange={e => handleEmailChange(e.target.value)}
							onKeyDown={handleEnterCommit}
							maxLength={254}
							autoComplete="email"
						/>
					</SettingsField>

					<SettingsField
						label="Display name"
						dirty={feedback.isDirty("display-name")}
						saved={feedback.isSaved("display-name")}
						error={feedback.getError("display-name")}
						htmlFor="settings-display-name"
					>
						<Input
							id="settings-display-name"
							type="text"
							value={displayName}
							onChange={e => handleDisplayNameChange(e.target.value)}
							onKeyDown={handleEnterCommit}
							maxLength={80}
							autoComplete="name"
						/>
					</SettingsField>

					<SettingsField
						label="Native language"
						hint="Used to tune AI explanations and prompts."
						saved={feedback.isSaved("native-language")}
						error={feedback.getError("native-language")}
						htmlFor="settings-native-language"
					>
						<TomoSelect
							id="settings-native-language"
							value={native}
							options={LANGUAGES}
							onValueChange={v => void handleNativeChange(v)}
							ariaLabel="Native language"
						/>
					</SettingsField>

					<SettingsField
						label="Timezone"
						hint="Used to compute today's queue and forecast windows."
						dirty={feedback.isDirty("timezone")}
						saved={feedback.isSaved("timezone")}
						error={feedback.getError("timezone")}
						htmlFor="settings-timezone"
					>
						<Input
							id="settings-timezone"
							type="text"
							value={timezone}
							onChange={e => handleTimezoneChange(e.target.value)}
							onKeyDown={handleEnterCommit}
							maxLength={100}
							placeholder="e.g. America/New_York"
							autoComplete="off"
						/>
					</SettingsField>

					<SettingsField
						label="Study goal"
						hint="One short sentence. Used to personalise example sentences."
						dirty={feedback.isDirty("study-goal")}
						saved={feedback.isSaved("study-goal")}
						error={feedback.getError("study-goal")}
						htmlFor="settings-study-goal"
					>
						<Textarea
							id="settings-study-goal"
							value={studyGoal}
							onChange={e => handleStudyGoalChange(e.target.value)}
							maxLength={500}
							rows={3}
							placeholder="e.g. Reading novels by next spring."
							className="resize-none leading-relaxed"
						/>
					</SettingsField>
				</div>

				<div className="mt-6 flex flex-wrap items-center gap-2 pl-3">
					<Button
						type="button"
						variant="primary"
						size="sm"
						disabled={!formDirty}
						loading={submitting}
						onClick={() => void submitDirty()}
					>
						Save changes
					</Button>
					{formDirty && !submitting && (
						<p className="font-mono text-sm text-faded-sumi">
							Press Enter or click to commit
						</p>
					)}
				</div>
			</SectionCard>
		</SectionShell>
	);
}

function isLanguageValue(v: string): v is LanguageValue {
	return LANGUAGES.some(l => l.value === v);
}

function isValidEmail(s: string): boolean {
	return /^\S[^\s@]*@\S[^\s.]*\.\S+$/.test(s);
}

// Supabase auth errors surface client-side (no RSC-boundary redaction), but
// their default register can be techy. Soften the common cases; otherwise the
// Supabase message is already written for end users, so pass it through with a
// clean fallback.
function friendlyAuthError(message: string | undefined): string {
	const fallback = "We couldn’t save that. Please try again.";
	if (message === undefined || message.trim() === "")
		return fallback;
	const m = message.toLowerCase();
	if (m.includes("rate limit") || m.includes("for security purposes")) {
		return "Too many attempts — please wait a moment and try again.";
	}
	if (m.includes("already registered") || (m.includes("already") && m.includes("email"))) {
		return "That email is already in use.";
	}
	if (m.includes("invalid") && m.includes("email")) {
		return "Enter a valid email address.";
	}
	return message;
}

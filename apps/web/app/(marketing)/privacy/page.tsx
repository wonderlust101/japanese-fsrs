import type { Metadata } from "next";

import type { TocEntry } from "../_components/marketing-doc";
import { LegalList, LegalP, LegalSection, LegalShell } from "../_components/legal";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description:
    "How Tomo collects, uses, and protects your data: account information, your study cards and review history, cookies, the service providers Tomo relies on, and your rights.",
	alternates: { canonical: "/privacy" },
};

const TOC: readonly TocEntry[] = [
	{ id: "collect", label: "Information we collect" },
	{ id: "cookies", label: "Cookies and local storage" },
	{ id: "use", label: "How we use information" },
	{ id: "bases", label: "Legal bases (EEA / UK)" },
	{ id: "providers", label: "Service providers" },
	{ id: "transfers", label: "International transfers" },
	{ id: "retention", label: "Retention and deletion" },
	{ id: "rights", label: "Your rights and choices" },
	{ id: "security", label: "Security" },
	{ id: "children", label: "Children" },
	{ id: "changes", label: "Changes" },
];

export default function PrivacyPage(): React.JSX.Element {
	return (
		<LegalShell
			title="Privacy Policy"
			updated="May 25, 2026"
			kanji="守"
			toc={TOC}
			intro="This policy explains what Tomo collects, why, and the choices you have. Tomo (“we”, “us”) is a spaced-repetition app built for Japanese learners."
		>
			<LegalSection id="collect" heading="Information we collect">
				<LegalP>We collect the following, most of it created by your own use of Tomo:</LegalP>
				<LegalList>
					<li>
						<strong className="font-semibold">Account information:</strong>
						{" "}
						the email address you sign
						up with and the identifiers managed by our authentication provider. If you sign in through a
						third-party provider, the basic profile details they share with us.
					</li>
					<li>
						<strong className="font-semibold">Learning data:</strong>
						{" "}
						the cards you create or copy, your
						reviews, ratings, schedule and FSRS state, your study goal and target level, and the
						weak-spot diagnostics Tomo derives from your reviews.
					</li>
					<li>
						<strong className="font-semibold">Content you submit:</strong>
						{" "}
						the words and text you enter
						for card, sentence, and mnemonic generation.
					</li>
					<li>
						<strong className="font-semibold">Technical and usage data:</strong>
						{" "}
						device and browser
						type, IP address, and log, diagnostic, and basic feature-usage data needed to keep the
						service running, secure, and improving.
					</li>
				</LegalList>
			</LegalSection>

			<LegalSection id="cookies" heading="Cookies and local storage">
				<LegalP>
					Tomo uses cookies and local storage only to provide the service, not to advertise or track you
					across other sites:
				</LegalP>
				<LegalList>
					<li>
						<strong className="font-semibold">Strictly necessary cookies</strong>
						{" "}
						set by our
						authentication provider keep you signed in and protect your session.
					</li>
					<li>
						<strong className="font-semibold">Local storage</strong>
						{" "}
						on your device holds app
						preferences and buffers offline reviews so they sync when you reconnect.
					</li>
				</LegalList>
				<LegalP>
					We do not use advertising or cross-site tracking cookies. Because the cookies we set are
					strictly necessary to deliver the service, they do not require consent in most jurisdictions;
					where local law requires a consent banner, it should be configured for that deployment.
				</LegalP>
			</LegalSection>

			<LegalSection id="use" heading="How we use information">
				<LegalP>We use your information to:</LegalP>
				<LegalList>
					<li>run your spaced-repetition schedule and keep your review history accurate;</li>
					<li>generate study material (readings, example sentences, mnemonics) from the Japanese you add;</li>
					<li>identify the words you find difficult and suggest focused next steps;</li>
					<li>maintain, secure, and improve the service, and enforce fair-use limits;</li>
					<li>communicate with you about your account and material changes to the service.</li>
				</LegalList>
				<LegalP>
					We do not sell your personal information, and we do not use your learning content to train
					third-party models beyond producing your own study material.
				</LegalP>
			</LegalSection>

			<LegalSection id="bases" heading="Legal bases (EEA / UK)">
				<LegalP>
					If you are in the EEA or the UK, we process your personal data on these legal bases:
				</LegalP>
				<LegalList>
					<li>
						<strong className="font-semibold">Performance of a contract:</strong>
						{" "}
						providing the service you signed up for.
					</li>
					<li>
						<strong className="font-semibold">Legitimate interests:</strong>
						{" "}
						securing the service, preventing abuse, and improving features, balanced against your rights.
					</li>
					<li>
						<strong className="font-semibold">Consent:</strong>
						{" "}
						where required, such as optional communications; you may withdraw consent at any time.
					</li>
					<li>
						<strong className="font-semibold">Legal obligation:</strong>
						{" "}
						where we must process data to comply with the law.
					</li>
				</LegalList>
			</LegalSection>

			<LegalSection id="providers" heading="Service providers">
				<LegalP>
					Tomo relies on a small number of providers that act on our instructions as processors:
				</LegalP>
				<LegalList>
					<li>
						a
						<strong className="font-semibold">database and authentication provider</strong>
						{" "}
						that stores your account and learning data;
					</li>
					<li>
						a
						<strong className="font-semibold">language-model provider</strong>
						{" "}
						that generates card content, sentences, mnemonics, and weak-spot guidance from the words you add;
					</li>
					<li>
						a
						<strong className="font-semibold">caching and rate-limiting provider</strong>
						{" "}
						used for performance and abuse prevention.
					</li>
				</LegalList>
				<LegalP>
					Text you submit for generation is sent to the language-model provider solely to produce your
					study material. It is not used to serve ads, and we do not permit these providers to use it for
					their own purposes.
				</LegalP>
			</LegalSection>

			<LegalSection id="transfers" heading="International data transfers">
				<LegalP>
					Our providers may process data in countries other than your own, including the United States.
					Where we transfer personal data out of the EEA, the UK, or other regulated regions, we rely on
					appropriate safeguards, such as the Standard Contractual Clauses or an equivalent transfer
					mechanism, to protect it.
				</LegalP>
			</LegalSection>

			<LegalSection id="retention" heading="Retention and deletion">
				<LegalP>
					We keep your account and learning data while your account is active. You can delete your
					account at any time from Settings → Security; deletion removes your personal cards, reviews,
					and schedule, typically within 30 days, and backups are purged on a rolling cycle after that.
					We may retain limited records where we must to comply with the law, resolve disputes, or
					enforce our agreements, and we may keep aggregated or de-identified data that no longer
					identifies you.
				</LegalP>
			</LegalSection>

			<LegalSection id="rights" heading="Your rights and choices">
				<LegalP>
					Depending on where you live, you may have the right to access, correct, delete, or export your
					data, and to restrict or object to certain processing or withdraw consent. Residents of the
					EEA or UK may lodge a complaint with their supervisory authority. California residents may
					request to know, delete, and opt out of any “sale” or “sharing” of personal information (Tomo
					does not sell or share in that sense) and will not be treated differently for exercising these
					rights.
				</LegalP>
				<LegalP>
					You can review and update much of your information in Settings, and delete your account
					whenever you choose. To exercise any other right, reach us through the app; we may need to
					verify your identity before we act.
				</LegalP>
			</LegalSection>

			<LegalSection id="security" heading="Security">
				<LegalP>
					We protect your data with access controls, least-privilege access, and encryption in transit.
					No method of storage or transmission is perfectly secure, but we work to safeguard your
					information and limit who can reach it.
				</LegalP>
			</LegalSection>

			<LegalSection id="children" heading="Children">
				<LegalP>
					Tomo is not directed to children under the age required by your local law (for example, 13 in
					the United States and as high as 16 in parts of the EEA). We do not knowingly collect their
					personal information; if you believe a child has provided us data, contact us and we will
					remove it.
				</LegalP>
			</LegalSection>

			<LegalSection id="changes" heading="Changes to this policy">
				<LegalP>
					We may update this policy from time to time. When we do, we will revise the date above and, for
					material changes, provide a more prominent notice before they take effect.
				</LegalP>
			</LegalSection>
		</LegalShell>
	);
}

"use client";

import Link from "next/link";

import { Dialog } from "@/components/ui/Dialog";
import { KbdChip } from "@/components/ui/KbdChip";
import { SectionKicker } from "@/components/ui/SectionKicker";
import { useHelpDialogActions, useHelpDialogOpen } from "@/stores/useHelpDialogStore";

interface Shortcut {
	keys: readonly string[];
	joiner?: "chord" | "alternatives";
	label: string;
}

interface ShortcutGroup {
	kicker: string;
	shortcuts: readonly Shortcut[];
}

const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
	{
		kicker: "Global",
		shortcuts: [
			{ keys: ["?"], label: "Open this help dialog" },
			{ keys: ["["], label: "Toggle the sidebar" },
			{ keys: ["Cmd", "K"], label: "Open search", joiner: "chord" },
		],
	},
	{
		kicker: "During review",
		shortcuts: [
			{ keys: ["Space"], label: "Reveal the answer" },
			{ keys: ["1", "2", "3", "4"], label: "Rate Again / Hard / Good / Easy", joiner: "alternatives" },
			{ keys: ["M"], label: "Toggle the mnemonic tab" },
			{ keys: ["K"], label: "Toggle the kanji-breakdown tab" },
			{ keys: ["U"], label: "Undo the last rating (3-second window)" },
		],
	},
	{
		kicker: "On the cards page",
		shortcuts: [
			{ keys: ["F"], label: "Open the Add filter menu" },
			{ keys: ["V"], label: "Open the View picker" },
		],
	},
	{
		kicker: "On a card",
		shortcuts: [
			{ keys: ["E"], label: "Edit this card" },
			{ keys: ["Shift", "M"], label: "Open the memory popup", joiner: "chord" },
		],
	},
];

export function HelpDialog(): React.JSX.Element {
	const open = useHelpDialogOpen();
	const { closeHelp } = useHelpDialogActions();

	return (
		<Dialog
			open={open}
			onClose={closeHelp}
			title="Quick reference"
			eyebrow={{ kanji: "助", label: "HELP" }}
			size="md"
		>
			<div className="flex flex-col gap-7">
				{SHORTCUT_GROUPS.map(group => (
					<section key={group.kicker} className="flex flex-col gap-3">
						<SectionKicker>{group.kicker}</SectionKicker>
						<ul className="flex flex-col gap-2">
							{group.shortcuts.map(s => (
								<li key={s.label} className="flex items-baseline gap-3">
									<ShortcutKeys keys={s.keys} joiner={s.joiner ?? "chord"} />
									<span className="text-sm text-sumi-ink/85 leading-snug">{s.label}</span>
								</li>
							))}
						</ul>
					</section>
				))}

				<section className="flex flex-col gap-3">
					<SectionKicker>How Tomo works</SectionKicker>
					<p className="max-w-measure text-sm leading-relaxed text-sumi-ink/85">
						Tomo schedules each card by how well you know it. Rate honestly after
						you reveal the answer; cards you find hard come back sooner, cards
						you find easy wait longer. The morning ritual matters more than the
						count.
					</p>
				</section>

				<section className="flex flex-col gap-2">
					<SectionKicker>Settings and account</SectionKicker>
					<ul className="flex flex-col gap-2 text-sm">
						<li><DialogLink href="/settings/learning" onNavigate={closeHelp}>Learning preferences</DialogLink></li>
						<li><DialogLink href="/settings/profile" onNavigate={closeHelp}>Profile</DialogLink></li>
						<li><DialogLink href="/settings/security" onNavigate={closeHelp}>Security</DialogLink></li>
					</ul>
				</section>
			</div>
		</Dialog>
	);
}

function ShortcutKeys({
	keys,
	joiner,
}: {
	keys: readonly string[];
	joiner: "chord" | "alternatives";
}): React.JSX.Element {
	const separator = joiner === "chord" ? "+" : "·";
	return (
		<span className="flex flex-shrink-0 items-center gap-1">
			{keys.map((k, i) => (
				<span key={`${k}-${i}`} className="flex items-center gap-1">
					<KbdChip size="xs" className="inline-flex min-w-[20px] justify-center">{k}</KbdChip>
					{i < keys.length - 1 && (
						<span aria-hidden="true" className="text-xs text-faded-sumi/60">{separator}</span>
					)}
				</span>
			))}
		</span>
	);
}

function DialogLink({
	href,
	onNavigate,
	children,
}: {
	href: string;
	onNavigate: () => void;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			className="text-sumi-ink underline decoration-soft-hairline decoration-1 underline-offset-2 hover:decoration-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-xs transition-colors duration-150"
		>
			{children}
		</Link>
	);
}

"use client";

import { useState } from "react";
import { CapsLockHint } from "@/components/ui/CapsLockHint";
import { Input } from "@/components/ui/Input";
import { KbdChip } from "@/components/ui/KbdChip";
import { OTPInput } from "@/components/ui/OtpInput";
import { Radio } from "@/components/ui/Radio";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { ShowcaseGrid, ShowcaseItem } from "../_components/ShowcaseItem";
import { ShowcaseSection } from "../_components/ShowcaseSection";

const LANG_OPTIONS = [
	{ value: "en", label: "English" },
	{ value: "ja", label: "日本語" },
	{ value: "es", label: "Español" },
];

export function InputsSection(): React.JSX.Element {
	const [otp, setOtp] = useState("");
	const [searchDraft, setSearchDraft] = useState("");
	const [scopedSearch, setScopedSearch] = useState("");
	const [radioPick, setRadioPick] = useState<"a" | "b">("a");

	return (
		<ShowcaseSection
			id="inputs"
			title="Inputs"
			description="Form primitives: Input, Textarea, Select, SearchInput, Radio, OTPInput, CapsLockHint."
		>
			<div>
				<h3 className="text-xs text-faded-sumi mb-3">Input</h3>
				<ShowcaseGrid minColumnWidth={280}>
					<ShowcaseItem label="Default" caption='size="md"' fill>
						<Input label="Email" placeholder="you@example.com" />
					</ShowcaseItem>
					<ShowcaseItem label="With hint" caption="hint" fill>
						<Input label="Password" type="password" hint="At least 12 characters." />
					</ShowcaseItem>
					<ShowcaseItem label="With error" caption='error="..."' fill>
						<Input label="Email" defaultValue="not-an-email" error="That's not a valid email." />
					</ShowcaseItem>
					<ShowcaseItem label="Japanese (kana)" caption='script="kana"' fill>
						<Input label="読み" script="kana" placeholder="たべる" />
					</ShowcaseItem>
					<ShowcaseItem label="Small" caption='size="sm"' fill>
						<Input label="Search" size="sm" placeholder="Search decks" />
					</ShowcaseItem>
					<ShowcaseItem label="Large" caption='size="lg"' fill>
						<Input label="Name" size="lg" placeholder="Your name" />
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>

			<div>
				<h3 className="text-xs text-faded-sumi mb-3">Select</h3>
				<ShowcaseGrid minColumnWidth={280}>
					<ShowcaseItem label="Default" caption="options=[...]" fill>
						<Select label="Language" options={LANG_OPTIONS} />
					</ShowcaseItem>
					<ShowcaseItem label="With error" caption='error="..."' fill>
						<Select label="Language" options={LANG_OPTIONS} error="Pick one." />
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>

			<div>
				<h3 className="text-xs text-faded-sumi mb-3">SearchInput</h3>
				<ShowcaseGrid minColumnWidth={320}>
					<ShowcaseItem label="Page-level" caption="trailing=<KbdChip>⌘K</KbdChip>" fill>
						<SearchInput
							value={searchDraft}
							onChange={setSearchDraft}
							ariaLabel="Search demo"
							placeholder="Search by word, reading, meaning…"
							trailing={(
								<KbdChip placement="floating" className="hidden sm:inline-flex">
									⌘K
								</KbdChip>
							)}
						/>
					</ShowcaseItem>
					<ShowcaseItem label="Scoped" caption="no trailing slot" fill>
						<SearchInput
							value={scopedSearch}
							onChange={setScopedSearch}
							ariaLabel="Scoped search demo"
							placeholder="Search this deck"
						/>
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>

			<div>
				<h3 className="text-xs text-faded-sumi mb-3">Radio</h3>
				<ShowcaseGrid minColumnWidth={280}>
					<ShowcaseItem label="Tile group" caption="native input + visual glyph" fill>
						<fieldset className="flex flex-col gap-2">
							<legend className="sr-only">Demo radio group</legend>
							{(["a", "b"] as const).map((opt) => {
								const checked = radioPick === opt;
								return (
									<label
										key={opt}
										className={[
											"group flex cursor-pointer items-start gap-3 rounded-xs border px-4 py-3 transition-colors",
											"has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-sumi-ink has-[:focus-visible]:outline-offset-2",
											checked ? "border-inari-vermillion bg-vermillion-wash/40" : "border-soft-hairline hover:border-faded-sumi",
										].join(" ")}
									>
										<input
											type="radio"
											name="demo-radio"
											checked={checked}
											onChange={() => setRadioPick(opt)}
											className="sr-only"
										/>
										<span className="mt-0.5">
											<Radio checked={checked} className="group-hover:border-faded-sumi" />
										</span>
										<span className="text-sm font-medium text-sumi-ink">
											Option
											{" "}
											{opt.toUpperCase()}
										</span>
									</label>
								);
							})}
						</fieldset>
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>

			<div>
				<h3 className="text-xs text-faded-sumi mb-3">OTP + CapsLockHint</h3>
				<ShowcaseGrid minColumnWidth={320}>
					<ShowcaseItem
						label="OTPInput"
						caption={`onComplete=(otp)=>... · current="${otp}"`}
						fill
					>
						<OTPInput onComplete={setOtp} />
					</ShowcaseItem>
					<ShowcaseItem label="CapsLockHint" caption="static (parent controls visibility)" fill>
						<CapsLockHint />
					</ShowcaseItem>
				</ShowcaseGrid>
			</div>
		</ShowcaseSection>
	);
}

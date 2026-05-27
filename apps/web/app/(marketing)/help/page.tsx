import type { Metadata } from "next";

import type { TocEntry } from "../_components/marketing-doc";
import type { FaqItem } from "@/components/seo/JsonLd";
import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { faqPageSchema, JsonLd } from "@/components/seo/JsonLd";

import { ButtonLink } from "@/components/ui/Button";
import { DocReveal, DocShell } from "../_components/marketing-doc";

export const metadata: Metadata = {
	title: "Help & FAQ",
	description:
    "How Tomo works, how to get started, and answers to common questions about spaced repetition, FSRS scheduling, premade JLPT decks, and accessibility.",
	alternates: { canonical: "/help" },
};

// Single source of truth for the FAQ: rendered visibly below AND emitted as
// FAQPage structured data so the on-page copy and the rich-result schema can
// never drift. Per PRODUCT.md the page says nothing about price (no Free/Paid
// question) — that omission is deliberate.
const FAQ_ITEMS: readonly FaqItem[] = [
	{
		question: "What is Tomo?",
		answer:
      "Tomo is a spaced-repetition app built specifically for Japanese learners. It schedules your reviews, helps you build high-quality cards, and points you at the words that need more work — all in one place.",
	},
	{
		question: "What is FSRS, and why does it matter?",
		answer:
      "FSRS (the Free Spaced Repetition Scheduler) is the modern algorithm Tomo uses to decide when to show each card. It times reviews to just before you would forget, so you spend less time reviewing and retain more.",
	},
	{
		question: "How is Tomo different from Anki?",
		answer:
      "Anki is powerful but spartan, and its cards are only as good as the time you spend making them. Tomo pairs modern FSRS scheduling with cards that come ready-made — readings, example sentences, and mnemonics — in a calmer, friendlier app.",
	},
	{
		question: "Do I have to make my own cards?",
		answer:
      "No. Tomo ships complete JLPT N5–N1 vocabulary decks you can start with immediately. When you do add a word, Tomo drafts the card for you — you just review and keep what fits.",
	},
	{
		question: "Does Tomo work on my phone?",
		answer:
      "Yes. Tomo runs in any modern browser and can be installed to your home screen on phones, tablets, and desktops. Many learners review on desktop in the morning and catch stray moments on mobile.",
	},
	{
		question: "What happens if I miss a day?",
		answer:
      "Your schedule simply picks up where you left off. Tomo has no streak pressure — missed practice is handled as recovery, never as failure.",
	},
	{
		question: "Is Tomo accessible?",
		answer:
      "Accessibility is part of the product, not an add-on: full keyboard review (number keys rate, space reveals), screen-reader support with correct Japanese pronunciation, reduced-motion support, and color-blind-safe rating controls.",
	},
	{
		question: "Does Tomo work offline?",
		answer:
      "Yes. Tomo buffers the reviews you do offline and syncs them automatically when you reconnect, so a spotty connection on the train never costs you a session.",
	},
	{
		question: "Can I export or delete my data?",
		answer:
      "You can delete your account and its data at any time from Settings → Security. If you would like a copy of your cards and review history first, you can request an export from the same place.",
	},
];

const STEPS: readonly { n: string; title: string; text: string }[] = [
	{ n: "1", title: "Choose your level", text: "Create your account and pick your JLPT target. Tomo starts you where you are, N5 through N1." },
	{ n: "2", title: "Add some words", text: "Subscribe to a premade deck, or capture your own words. Tomo drafts the card: reading, meaning, example, hook." },
	{ n: "3", title: "Review each morning", text: "A few focused minutes a day. Rate honestly after the reveal; Tomo handles every bit of the timing." },
];

const TOC: readonly TocEntry[] = [
	{ id: "getting-started", label: "Getting started" },
	{ id: "how-it-works", label: "How Tomo works" },
	{ id: "faq", label: "Frequently asked questions" },
];

const HOW_IT_WORKS: readonly { title: string; body: string }[] = [
	{
		title: "Scheduling that follows your memory",
		body: "Tomo uses FSRS, the modern spaced-repetition algorithm, to time each card to the moment just before you would forget it. Rate honestly after the reveal: cards you find hard return sooner, and cards you find easy wait longer.",
	},
	{
		title: "Cards that arrive ready",
		body: "Add a word and Tomo drafts the whole card: reading, meaning, a natural example sentence, and a memory hook. Edit anything, keep what fits, and start reviewing right away.",
	},
	{
		title: "A teacher’s eye for weak spots",
		body: "When two words keep crossing wires, Tomo notices, explains the difference in plain language, and brings the pair back together so you can finally pull them apart.",
	},
	{
		title: "A ritual, not a streak",
		body: "A few focused minutes each morning hold a surprising amount of Japanese in place. Miss a day and your schedule simply picks up where you left off; there is no streak to break.",
	},
];

export default function HelpPage(): React.JSX.Element {
	return (
		<>
			<JsonLd schema={faqPageSchema(FAQ_ITEMS)} />

			<DocShell
				kicker="Help"
				title="Help & FAQ"
				kanji="助"
				kanjiTone="vermillion"
				toc={TOC}
				lede="Everything you need to get going with Tomo, and answers to the questions learners ask most."
			>
				<div className="flex max-w-measure-wide flex-col gap-24">
					{/* Getting started — three beats, hairline-separated for calm rhythm. */}
					<DocReveal>
						<section aria-labelledby="getting-started" className="scroll-mt-24 flex flex-col gap-6">
							<h2 id="getting-started" className="scroll-mt-24 font-display text-2xl font-semibold tracking-[-0.01em] text-sumi-ink md:text-3xl">
								Getting started
							</h2>
							<ol className="flex flex-col">
								{STEPS.map(step => (
									<li
										key={step.n}
										className="flex items-baseline gap-5 border-t border-soft-hairline py-6 first:border-t-0 first:pt-0"
									>
										<span
											aria-hidden="true"
											className="font-mono text-2xl font-medium tabular-nums text-inari-vermillion"
										>
											{step.n}
										</span>
										<div className="flex flex-col gap-1">
											<h3 className="font-display text-lg font-semibold text-sumi-ink">{step.title}</h3>
											<p className="max-w-measure text-base leading-[1.6] text-faded-sumi">{step.text}</p>
										</div>
									</li>
								))}
							</ol>
						</section>
					</DocReveal>

					{/* How it works — a short framing line, then hairline-separated
              subsections (h3) for each mechanic, so the method scans without
              becoming fine print. */}
					<DocReveal>
						<section aria-labelledby="how-it-works" className="scroll-mt-24 flex flex-col gap-6">
							<h2 id="how-it-works" className="scroll-mt-24 font-display text-2xl font-semibold tracking-[-0.01em] text-sumi-ink md:text-3xl">
								How Tomo works
							</h2>
							<p className="max-w-measure text-md leading-[1.7] text-sumi-ink">
								Four things happen quietly so your study stays simple: Tomo schedules, drafts, watches
								for weak spots, and keeps the daily ritual gentle.
							</p>
							<div className="flex flex-col">
								{HOW_IT_WORKS.map(item => (
									<div
										key={item.title}
										className="flex flex-col gap-2 border-t border-soft-hairline py-6 first:border-t-0 first:pt-0"
									>
										<h3 className="font-display text-lg font-semibold text-sumi-ink">{item.title}</h3>
										<p className="max-w-measure text-base leading-[1.7] text-faded-sumi">{item.body}</p>
									</div>
								))}
							</div>
						</section>
					</DocReveal>

					{/* FAQ — editorial numbered list, mono indices, hairline separators. */}
					<DocReveal>
						<section aria-labelledby="faq" className="scroll-mt-24 flex flex-col gap-6">
							<h2 id="faq" className="scroll-mt-24 font-display text-2xl font-semibold tracking-[-0.01em] text-sumi-ink md:text-3xl">
								Frequently asked questions
							</h2>
							<dl className="flex flex-col">
								{FAQ_ITEMS.map((item, i) => (
									<div
										key={item.question}
										className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-t border-soft-hairline py-7 first:border-t-0 first:pt-0"
									>
										<span aria-hidden="true" className="font-mono text-sm tabular-nums text-faded-sumi">
											{String(i + 1).padStart(2, "0")}
										</span>
										<dt className="font-display text-lg font-semibold text-sumi-ink">{item.question}</dt>
										<dd className="col-start-2 mt-2 max-w-measure text-base leading-[1.7] text-faded-sumi">
											{item.answer}
										</dd>
									</div>
								))}
							</dl>
						</section>
					</DocReveal>

					{/* Closing CTA — the card identity device (vermillion top-stripe) at
              panel scale, a quiet echo of the home page's closing band. */}
					<DocReveal>
						<section
							aria-labelledby="help-cta"
							className="relative overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised px-6 py-8 sm:px-8"
						>
							<span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-inari-vermillion" />
							<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex flex-col gap-1">
									<h2 id="help-cta" className="font-display text-xl font-semibold text-sumi-ink">
										Ready when you are.
									</h2>
									<p className="max-w-measure text-sm leading-[1.6] text-faded-sumi">
										Pick a level, choose a few decks, review your first cards in minutes.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-3">
									<ButtonLink href="/signup" size="lg" trailingIcon={<ArrowGlyph direction="right" />}>
										Start practicing
									</ButtonLink>
									<ButtonLink href="/login" size="lg" variant="secondary">
										Sign in
									</ButtonLink>
								</div>
							</div>
						</section>
					</DocReveal>
				</div>
			</DocShell>
		</>
	);
}

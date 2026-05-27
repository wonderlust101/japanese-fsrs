import { cn } from "@/lib/utils";

interface TopBarTitleProps {
	/** Kanji glyph rendered inside the vermillion-wash hanko seal. */
	kanji: string;
	/** Page title shown beside the seal in the display face. */
	label: string;
	/** Optional BCP-47 lang tag for the label (e.g. "ja" when the label is a Japanese word). */
	labelLang?: string;
	/**
	 * Keep the title visible on mobile. Defaults false: in the (app) TopBar the
	 * brand mark occupies the title's slot below lg, so the title hides there.
	 * The immersive review/drill SessionTopBar has no brand mark and sets this
	 * true so its identity (kanji + "Reviewing") survives on mobile.
	 */
	keepOnMobile?: boolean;
	className?: string;
}

// Shared page-title cluster: a shubun-style hanko (kanji in vermillion on a
// vermillion-wash pad) paired with the page title in the display face. Used
// across (app) top bars and the review/drill session top bar so every page
// arrives with the same calligraphic stamp. Desktop-only: on mobile the TopBar
// renders the brand mark in this slot instead, so the title hides below lg.
//
// Mount animations (`animate-eyebrow-kanji-bloom` / `animate-eyebrow-label-ink`)
// keep their legacy names since the keyframes are referenced from globals.css.
export function TopBarTitle({ kanji, label, labelLang, keepOnMobile = false, className = "" }: TopBarTitleProps): React.JSX.Element {
	return (
		<div
			className={cn(
				"flex-1 items-center gap-2 min-w-0",
				keepOnMobile ? "flex" : "hidden lg:flex",
				className,
			)}
		>
			<span className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-xs bg-vermillion-wash animate-eyebrow-kanji-bloom">
				<span
					lang="ja"
					aria-hidden="true"
					className="font-japanese font-semibold text-lg text-inari-vermillion leading-none translate-y-[0.02em]"
				>
					{kanji}
				</span>
			</span>
			<p
				{...(labelLang !== undefined ? { lang: labelLang } : {})}
				className="font-display text-lg font-medium leading-none text-sumi-ink truncate animate-eyebrow-label-ink"
			>
				{label}
			</p>
		</div>
	);
}

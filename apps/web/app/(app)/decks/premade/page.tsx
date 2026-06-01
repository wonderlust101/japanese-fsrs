import type { Metadata } from "next";

import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";

import { PremadeCatalogue } from "./_components/premade-catalogue";

export const metadata: Metadata = { title: "Premade decks" };

// The page owns only the TopBar + the `flex-1` shell (fills the area below the
// sticky TopBar, instead of `min-h-screen` which overflowed by the bar's
// height). The catalogue owns the header + reading container so it can drop
// them while loading and center the loader in the shell — matching the
// Insights / weak-spots shells.
export default function PremadeDecksPage(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarTitle kanji="集" label="Premade decks" />
			</TopBar>

			<div className="flex-1 bg-cool-paper-base">
				<PremadeCatalogue />
			</div>
		</>
	);
}

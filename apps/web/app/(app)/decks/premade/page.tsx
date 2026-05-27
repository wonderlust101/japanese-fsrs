import type { Metadata } from "next";

import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { PAGE_HEADER_PADDING, PageHeader } from "@/components/ui/PageHeader";

import { PremadeCatalogue } from "./_components/premade-catalogue";

export const metadata: Metadata = { title: "Premade decks" };

export default function PremadeDecksPage(): React.JSX.Element {
	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
				<TopBarTitle kanji="集" label="Premade decks" />
			</TopBar>

			<div className="min-h-screen bg-cool-paper-base pb-32">
				<div className="relative mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
					<div className={PAGE_HEADER_PADDING}>
						<PageHeader
							kanji="集"
							label="Premade decks · curated by Tomo"
							title="Find a deck to start with."
							subtitle="Curated starter decks for JLPT N5 through N1, plus thematic collections. Add one to your library and Tomo creates a personal copy you can study, edit, and pause."
						/>
					</div>

					<PremadeCatalogue />
				</div>
			</div>
		</>
	);
}

import type { Metadata } from "next";

import { PremadeCatalogue } from "./_components/premade-catalogue";

export const metadata: Metadata = { title: "Premade decks" };

export default function PremadeDecksPage(): React.JSX.Element {
	return (
		<div className="flex-1 bg-cool-paper-base">
			<PremadeCatalogue />
		</div>
	);
}

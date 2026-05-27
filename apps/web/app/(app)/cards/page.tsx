import type { Metadata } from "next";

import { CardsBrowserView } from "./_components/cards-browser-view";

export const metadata: Metadata = { title: "Cards" };

export default function CardsBrowserPage(): React.JSX.Element {
	return <CardsBrowserView />;
}

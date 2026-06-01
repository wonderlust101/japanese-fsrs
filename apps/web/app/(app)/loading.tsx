import { PageLoader } from "@/components/ui/TomoLoader";

import { TopBar } from "./_components/top-bar";

/**
 * Streamed fallback for every route under (app) whose server component awaits
 * data before rendering (card/deck detail, edit, preview, today, settings, …).
 * Next.js shows this while the matched segment suspends, so navigation paints
 * the canonical page loader instantly instead of hanging on the previous route.
 *
 * It renders inside (app)/layout.tsx, so the sidebar and chrome stay put while
 * only the content area shows the loader. Routes that don't await server-side
 * (thin client shells) render immediately and never trigger this fallback.
 *
 * The bare loader used to omit the per-page TopBar, so on mobile the
 * hamburger + brand bar vanished during the server-await window and popped
 * back when the page resolved — a visible top-bar shift. We render the bar
 * here too (`desktopHidden`) so the mobile chrome is continuous across the
 * load: identical to every (app) page, which carries the same mobile bar.
 *
 * Only `desktopHidden`, deliberately: the server-await pages that fall through
 * to *this* fallback (today, add, edit, review/setup) all render a mobile-only
 * `<TopBar desktopHidden>`, so a desktop bar here would flash an empty header
 * and then disappear. Routes that DO show a titled desktop bar (deck/card
 * detail, deck previews) own a colocated loading.tsx that reserves it.
 */
export default function AppLoading(): React.JSX.Element {
	return (
		<>
			<TopBar desktopHidden />
			<PageLoader />
		</>
	);
}

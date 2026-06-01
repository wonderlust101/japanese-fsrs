import type { Metadata } from "next";

import { HelpDialog } from "@/components/help/HelpDialog";
import { AppTopBar } from "./_components/app-top-bar";
import { GlobalHelpKeybind } from "./_components/global-help-keybind";
import { MobileDrawer } from "./_components/mobile-drawer";
import { RouteFocusManager } from "./_components/route-focus-manager";
import { Sidebar } from "./_components/sidebar";

// Authenticated app surface — search engines should never index any of these
// routes. Per-page titles set in each page.tsx flow through the root template.
export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

// The middleware guarantees an authenticated user reaches this layout.
// UserMenu fetches its own display data client-side so this layout stays sync
// and never contributes to a loading-state cascade.
export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="flex h-dvh bg-cool-paper-base overflow-hidden">
			{/* Skip link: first focusable element so keyboard users can bypass the
          sidebar nav. Visually hidden until focused; --z-toast keeps it above
          all chrome when it appears. Targets the <main> below. */}
			<a
				href="#main-content"
				className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[var(--z-toast)] focus-visible:rounded-xs focus-visible:border focus-visible:border-soft-hairline focus-visible:bg-warm-paper-raised focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-sumi-ink focus-visible:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
			>
				Skip to main content
			</a>
			<Sidebar />

			{/* Main content column */}
			<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
				{/* Persistent top bar — lives outside <main> so it never unmounts
				    during page transitions. AppTopBar derives chrome from the current
				    pathname (static routes) and the useTopBarStore override (dynamic
				    titles / actions set via SetTopBar). */}
				<AppTopBar />
				<main id="main-content" tabIndex={-1} className="flex flex-col flex-1 overflow-y-auto outline-none">
					{children}
				</main>
			</div>

			{/* Mobile chrome: drawer overlay triggered by the hamburger inside TopBar.
          Always rendered; visibility/transform driven by useMobileNavStore. */}
			<MobileDrawer />

			{/* Global help: dialog + ? keybind, mounted once for every (app) route.
          Opened from the sidebar/drawer HelpRow or the ? shortcut. */}
			<HelpDialog />
			<GlobalHelpKeybind />
			<RouteFocusManager />
		</div>
	);
}

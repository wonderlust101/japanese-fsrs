"use client";

import type { ReactNode } from "react";
import type { Corner } from "./useDraggableSnap";

import { useState } from "react";
import { DevDock } from "./DevDock";
import { DevDockContextProvider } from "./DevDockContext";
import { FloatingLauncher } from "./FloatingLauncher";

interface DevDockProviderProps {
	children: ReactNode;
}

/**
 * Top-level dev dock surface: provider + dock + launcher.
 *
 * Must WRAP the route content, not sit beside it. Earlier this component
 * accepted no children and was rendered as a sibling of `{children}` in
 * the root layout. That looked correct from the outside — the dock and
 * launcher rendered — but `useDevDockContext()` from any page hook walked
 * up the tree, found no `DevDockContextProvider` ancestor (it lived only
 * inside this component), and fell back to `NO_OP_CONTEXT`. Every
 * `ctx.register(...)` call from page-side hooks was silently discarded,
 * which is why the dock kept showing "no panels here" even on routes
 * that called `useDevStatePanel` / `useDevPanel`.
 *
 * The fix is to wrap `children` in the same `DevDockContextProvider` that
 * wraps the dock and launcher. In production this component still passes
 * children through, just without the dock surface mounted — so route
 * hooks still see `NO_OP_CONTEXT` and remain harmless.
 *
 * Mount once in the root layout so the context spans (app), (auth),
 * /onboarding, and any other route segment.
 */
export function DevDockProvider({ children }: DevDockProviderProps): React.JSX.Element {
	if (process.env.NODE_ENV !== "development")
		return <>{children}</>;
	return <DevDockProviderInner>{children}</DevDockProviderInner>;
}

function DevDockProviderInner({ children }: DevDockProviderProps): React.JSX.Element {
	// The launcher's current corner is held here so the dock can anchor its
	// initial position adjacent to the launcher's resting place.
	const [launcherCorner, setLauncherCorner] = useState<Corner>("br");

	return (
		<DevDockContextProvider launcherCorner={launcherCorner}>
			{children}
			<DevDock />
			<FloatingLauncher onCornerChange={setLauncherCorner} />
		</DevDockContextProvider>
	);
}

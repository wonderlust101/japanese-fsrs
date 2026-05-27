// Public surface for the dev dock. Pages register state panels through these
// two hooks; the dock and the launcher are mounted once via `DevDockProvider`
// in the root layout.

export type { DevFixtureSpec } from "./DevDockContext";
export { DevDockProvider } from "./DevDockProvider";
export { useDevPanel, useDevStatePanel } from "./useDevStatePanel";
export type {
	UseDevPanelOptions,
	UseDevStatePanelOptions,
	UseDevStatePanelResult,
} from "./useDevStatePanel";

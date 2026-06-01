import { PageLoader } from "@/components/ui/TomoLoader";

/**
 * Fallback for settings leaf segments (/settings/profile, /learning, /security)
 * while their server components await. Deliberately bar-less: settings/layout.tsx
 * already renders the TopBar + tab bar, and those persist across the leaf's
 * suspense. Without this file the subtree would inherit (app)/loading.tsx, which
 * carries its own mobile bar, and stack a second bar beneath the layout's.
 */
export default function SettingsLoading(): React.JSX.Element {
	return <PageLoader />;
}

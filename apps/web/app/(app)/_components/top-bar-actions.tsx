import { cn } from "@/lib/utils";

interface TopBarActionsProps {
	children: React.ReactNode;
	className?: string;
}

// Right-side action cluster inside a TopBar. Pairs with TopBarTitle (which
// claims the remaining slack via `flex-1`), so anything wrapped here is
// pushed to the right edge automatically. The tighter internal gap visually
// binds the actions together as one cluster, distinct from the bar's outer
// rhythm.
export function TopBarActions({ children, className = "" }: TopBarActionsProps): React.JSX.Element {
	return (
		<div className={cn("flex shrink-0 items-center gap-2", className)}>
			{children}
		</div>
	);
}

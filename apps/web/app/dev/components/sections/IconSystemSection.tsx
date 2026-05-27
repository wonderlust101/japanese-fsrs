import type { ChromeMarkEntry } from "@/components/icons/chrome-marks";
import { CHROME_MARKS, IconDashboard } from "@/components/icons/chrome-marks";
import { ShowcaseSection } from "../_components/ShowcaseSection";

/**
 * Showcase for the canonical chrome icon system.
 *
 * Consumes `apps/web/components/icons/chrome-marks.tsx` directly. Icons
 * are fully static; only the cell's color tier transitions on hover.
 */
export function IconSystemSection(): React.JSX.Element {
	return (
		<ShowcaseSection
			id="icon-system"
			title="Icon system — chrome marks"
			description="Brand-aligned chrome icons baked with Tomo's signature devices: card top-stripe, hi-no-maru focal discs, tategaki text, kanji-stroke weight rhythm, mizuhiki knots. 40x40 viewBox, 1.25 stroke, round caps and joins. Icons are static; state is communicated entirely via inherited color shifts on the parent row."
		>
			<style>
				{`
        .tomo-iconcell {
          color: #6B5F58;
          background-color: transparent;
          transition: color 150ms cubic-bezier(0.16, 1, 0.3, 1),
                      background-color 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tomo-iconcell:hover,
        .tomo-iconcell:focus-visible,
        .tomo-iconcell[data-state="hover"] {
          color: #1F1A18;
          background-color: #F4EFE6;
        }
        .tomo-iconcell[data-state="active"] {
          color: #B03646;
          background-color: #F8E5E5;
        }
      `}
			</style>

			<ColorTierStrip />
			<IconGroups />
			<StatesPanel />
		</ShowcaseSection>
	);
}

// ── Color tier strip ─────────────────────────────────────────────────────

function ColorTierStrip(): React.JSX.Element {
	return (
		<div className="border border-soft-hairline rounded-xs bg-warm-paper-raised">
			<div className="px-5 py-3 border-b border-soft-hairline">
				<p className="text-xs text-faded-sumi">Color tiers</p>
				<h3 className="font-display text-base text-sumi-ink mt-0.5">
					Three saturation levels via `currentColor` inheritance.
				</h3>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 px-5 py-4 text-sm text-sumi-ink">
				<Tier label="Default rest" swatch="#6B5F58" name="Faded Sumi" detail="Icon inherits from parent row." />
				<Tier label="Hover" swatch="#1F1A18" name="Sumi Ink" detail="Cell background tints to Cream Inset." />
				<Tier label="Active route" swatch="#B03646" name="Inari Vermillion" detail="Cell background to Vermillion Wash." />
			</div>
		</div>
	);
}

function Tier({
	label,
	swatch,
	name,
	detail,
}: {
	label: string;
	swatch: string;
	name: string;
	detail: string;
}): React.JSX.Element {
	return (
		<div className="flex items-start gap-3">
			<span
				className="block w-6 h-6 rounded-xs flex-shrink-0 mt-0.5 border border-soft-hairline"
				style={{ backgroundColor: swatch }}
			/>
			<div className="flex flex-col">
				<span className="text-xs text-faded-sumi font-medium">{label}</span>
				<span className="text-sm text-sumi-ink leading-tight">{name}</span>
				<span className="text-sm text-faded-sumi leading-snug mt-0.5">{detail}</span>
			</div>
		</div>
	);
}

// ── Icon groups (single canonical set) ──────────────────────────────────

const GROUP_ORDER: ReadonlyArray<{ group: ChromeMarkEntry["group"]; label: string; note: string }> = [
	{ group: "nav", label: "Nav", note: "Primary sidebar destinations." },
	{ group: "account", label: "Account menu", note: "Items in the user-menu popover from the sidebar bottom strip." },
	{ group: "status", label: "Status", note: "Topbar status row indicators." },
	{ group: "drawer", label: "Drawer", note: "Icon-only buttons (no text label)." },
	{ group: "topbar", label: "Topbar", note: "General-purpose chrome additions." },
	{ group: "action", label: "Action", note: "Review-session playback controls." },
	{ group: "edit", label: "Edit", note: "Card lifecycle: create, modify, remove, duplicate." },
	{ group: "data", label: "Data", note: "Organization: tag, filter, sort, schedule." },
	{ group: "feedback", label: "Feedback", note: "Correctness signals and alerts." },
	{ group: "progress", label: "Progress", note: "Motivation and achievements." },
	{ group: "lang", label: "Language", note: "Japanese-learning-specific affordances." },
];

function IconGroups(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-y-8">
			{GROUP_ORDER.map(({ group, label, note }) => {
				const entries = CHROME_MARKS.filter(e => e.group === group);
				return (
					<div key={group}>
						<div className="mb-4 flex items-baseline gap-3 border-b border-soft-hairline pb-2">
							<h3 className="font-display text-base text-sumi-ink">{label}</h3>
							<p className="text-sm text-faded-sumi">{note}</p>
							<span className="text-sm text-faded-sumi/70 ml-auto font-mono">{entries.length}</span>
						</div>
						<div
							className="grid gap-3"
							style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
						>
							{entries.map((entry) => {
								const Icon = entry.component;
								return (
									<div
										key={entry.name}
										className={[
											"tomo-iconcell",
											"flex flex-col items-stretch gap-3",
											"border border-soft-hairline rounded-xs",
											"px-4 pt-4 pb-3",
										].join(" ")}
										tabIndex={0}
									>
										<div className="flex items-center justify-center min-h-[80px]">
											<Icon className="h-10 w-10" />
										</div>
										<div className="flex flex-col gap-0.5">
											<span className="text-xs font-medium leading-tight">{entry.name}</span>
											<span className="text-sm opacity-70 leading-snug">{entry.reference}</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── States panel ─────────────────────────────────────────────────────────

function StatesPanel(): React.JSX.Element {
	const Icon = IconDashboard;
	return (
		<div className="border border-soft-hairline rounded-xs bg-warm-paper-raised">
			<div className="px-5 py-3 border-b border-soft-hairline">
				<p className="text-xs text-faded-sumi">States</p>
				<h3 className="font-display text-base text-sumi-ink mt-0.5">
					Color tiers pinned side-by-side.
				</h3>
			</div>
			<div
				className="grid gap-0 divide-x divide-soft-hairline"
				style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
			>
				<StateCell label="Rest" caption="Icon Faded Sumi (#6B5F58).">
					<div className="tomo-iconcell px-3 py-2 rounded-xs">
						<Icon className="h-8 w-8" />
					</div>
				</StateCell>
				<StateCell label="Hover" caption="Icon Sumi Ink (#1F1A18). Cell Cream Inset.">
					<div className="tomo-iconcell px-3 py-2 rounded-xs" data-state="hover">
						<Icon className="h-8 w-8" />
					</div>
				</StateCell>
				<StateCell label="Active route" caption="Icon Inari Vermillion (#B03646). Cell Vermillion Wash.">
					<div className="tomo-iconcell px-3 py-2 rounded-xs" data-state="active">
						<Icon className="h-8 w-8" />
					</div>
				</StateCell>
				<StateCell label="Focus" caption="3px Vermillion Wash halo via box-shadow.">
					<div
						className="tomo-iconcell px-3 py-2 rounded-xs"
						style={{ boxShadow: "0 0 0 3px #F8E5E5" }}
					>
						<Icon className="h-8 w-8" />
					</div>
				</StateCell>
			</div>
		</div>
	);
}

function StateCell({
	label,
	caption,
	children,
}: {
	label: string;
	caption: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className="flex flex-col items-center justify-between gap-3 px-4 py-5">
			<div className="flex-1 flex items-center justify-center min-h-[64px]">{children}</div>
			<div className="text-center">
				<p className="text-xs font-medium text-sumi-ink">{label}</p>
				<p className="text-sm text-faded-sumi mt-0.5 leading-snug max-w-[180px]">{caption}</p>
			</div>
		</div>
	);
}

"use client";

// The card actions strip: a touch-first row with an overflow menu below lg,
// and an open desktop toolbar clustered by utility at lg+. Lifted out of
// card-detail-view.tsx.

import { DecksMenu, MenuItem, MenuSeparator } from "@/app/(app)/decks/_components/decks-menu";
import { IconCalendar, IconDecks, IconDelete, IconEdit, IconHide, IconMore, IconPause, IconPlay, IconReveal, IconUndo } from "@/components/icons/chrome-marks";

import { ActionButton, ActionLink, ToolAction, ToolDivider, ToolGroup } from "./card-tools";

export function CardActionsStrip({
	editHref,
	isPremade,
	isSuspended,
	historyOpen,
	onMove,
	onToggleHistory,
	onForget,
	onReschedule,
	onSuspend,
	onDelete,
}: {
	editHref: string;
	isPremade: boolean;
	isSuspended: boolean;
	historyOpen: boolean;
	onMove: () => void;
	onToggleHistory: () => void;
	onForget: () => void;
	onReschedule: () => void;
	onSuspend: () => void;
	onDelete: () => void;
}): React.JSX.Element {
	const dot = <span aria-hidden="true" className="text-faded-sumi/55">·</span>;
	const suspendIcon = isSuspended
		? <IconPlay className="h-4 w-4" />
		: <IconPause className="h-4 w-4" />;
	const suspendLabel = isSuspended ? "Unsuspend" : "Suspend";

	return (
		<>
			{/* ── Touch context (< lg): the calm progressive-disclosure layout.
          This is the same line the app draws everywhere else — below lg there's
          no sidebar (the mobile drawer takes over), the surface is touch-first,
          and the "More" (⋯) menu gives every action a comfortable target
          instead of a row of 36px chips under a thumb. Two everyday actions stay
          inline; the rest live in the menu in intent order: placement → repair
          → pause → destroy. */}
			<nav
				aria-label="Card actions"
				className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm lg:hidden"
			>
				<ActionLink
					href={editHref}
					icon={<IconEdit className="h-4 w-4 shrink-0" />}
					disabled={isPremade}
					{...(isPremade ? { title: "Premade cards can’t be edited directly" } : {})}
				>
					Edit
				</ActionLink>
				{dot}
				<ActionButton
					onClick={onToggleHistory}
					icon={historyOpen
						? <IconHide className="h-4 w-4 shrink-0" />
						: <IconReveal className="h-4 w-4 shrink-0" />}
					ariaExpanded={historyOpen}
					ariaControls="card-history-panel"
					ariaHasPopup="dialog"
				>
					{historyOpen ? "Hide memory" : "Show memory"}
				</ActionButton>
				<DecksMenu
					align="end"
					menuClassName="min-w-[13rem]"
					renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef, menuId }) => (
						<button
							ref={triggerRef}
							type="button"
							onClick={onClick}
							onKeyDown={onKeyDown}
							aria-haspopup="menu"
							aria-expanded={ariaExpanded}
							aria-controls={menuId}
							aria-label="More actions"
							className={[
								"ui-motion-colors -my-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xs",
								"text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink active:bg-cream-inset",
								"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
							].join(" ")}
						>
							<IconMore className="h-4 w-4" />
						</button>
					)}
					renderItems={({ close }) => (
						<>
							<MenuItem
								leading={<IconDecks className="h-3.5 w-3.5" />}
								onClick={() => { onMove(); close(); }}
								disabled={isPremade}
							>
								Move to another deck
							</MenuItem>
							<MenuSeparator />
							<MenuItem
								leading={<IconUndo className="h-3.5 w-3.5" />}
								onClick={() => { onForget(); close(); }}
							>
								Forget
							</MenuItem>
							<MenuItem
								leading={<IconCalendar className="h-3.5 w-3.5" />}
								onClick={() => { onReschedule(); close(); }}
							>
								Reschedule
							</MenuItem>
							<MenuSeparator />
							<MenuItem
								leading={suspendIcon}
								onClick={() => { onSuspend(); close(); }}
							>
								{suspendLabel}
							</MenuItem>
							<MenuItem
								leading={<IconDelete className="h-3.5 w-3.5" />}
								onClick={() => { onDelete(); close(); }}
								disabled={isPremade}
								danger
							>
								Delete
							</MenuItem>
						</>
					)}
				/>
			</nav>

			{/* ── Desktop (lg+, pointer + sidebar): no overflow menu. Every action is
          laid out in the open and clustered by utility — like a Photoshop tool
          group — in the documented intent order: modify → inspect → organize →
          schedule-repair → availability. The row wraps by cluster on narrower
          desktops (lg sits at ~608px of content once the sidebar lands), so the
          generous inter-cluster gap carries the grouping; the hairline dividers
          only appear at xl+, where the toolbar is guaranteed a single row and a
          rule can't dangle at a wrap point. */}
			<nav
				aria-label="Card actions"
				className="hidden flex-wrap items-stretch gap-x-5 gap-y-3 text-sm lg:flex"
			>
				{/* Modify + inspect — the two things you do to read/change this card. */}
				<ToolGroup>
					<ToolAction
						href={editHref}
						icon={<IconEdit className="h-4 w-4" />}
						disabled={isPremade}
						{...(isPremade ? { title: "Premade cards can’t be edited directly" } : {})}
					>
						Edit
					</ToolAction>
					<ToolAction
						onClick={onToggleHistory}
						icon={historyOpen ? <IconHide className="h-4 w-4" /> : <IconReveal className="h-4 w-4" />}
						ariaExpanded={historyOpen}
						ariaControls="card-history-panel"
						ariaHasPopup="dialog"
					>
						{historyOpen ? "Hide memory" : "Show memory"}
					</ToolAction>
				</ToolGroup>

				<ToolDivider />

				{/* Organize — where the card lives. */}
				<ToolGroup>
					<ToolAction
						onClick={onMove}
						icon={<IconDecks className="h-4 w-4" />}
						disabled={isPremade}
						{...(isPremade ? { title: "Premade cards can’t be moved" } : {})}
					>
						Move
					</ToolAction>
				</ToolGroup>

				<ToolDivider />

				{/* Scheduling repair — reset or recompute the FSRS schedule. */}
				<ToolGroup>
					<ToolAction onClick={onForget} icon={<IconUndo className="h-4 w-4" />}>
						Forget
					</ToolAction>
					<ToolAction onClick={onReschedule} icon={<IconCalendar className="h-4 w-4" />}>
						Reschedule
					</ToolAction>
				</ToolGroup>

				<ToolDivider />

				{/* Availability — pause from reviews, or destroy. Delete is danger-styled
            and sits last so the destructive action is visually distinct. */}
				<ToolGroup>
					<ToolAction onClick={onSuspend} icon={suspendIcon}>
						{suspendLabel}
					</ToolAction>
					<ToolAction
						onClick={onDelete}
						icon={<IconDelete className="h-4 w-4" />}
						disabled={isPremade}
						danger
						{...(isPremade ? { title: "Premade cards can’t be deleted" } : {})}
					>
						Delete
					</ToolAction>
				</ToolGroup>
			</nav>
		</>
	);
}

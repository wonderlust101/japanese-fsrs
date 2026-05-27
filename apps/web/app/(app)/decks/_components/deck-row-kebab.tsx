"use client";

import {
	IconCopy,
	IconDelete,
	IconEdit,
	IconFlag,
	IconHide,
	IconMore,
	IconReveal,
} from "@/components/icons/chrome-marks";

import { DecksMenu, MenuItem, MenuSeparator } from "./decks-menu";

interface DeckRowKebabProps {
	isPriority: boolean;
	isArchived: boolean;
	canMoveUp: boolean;
	canMoveDown: boolean;
	onSetAsPriority: () => void;
	onRename: () => void;
	onCopy: () => void;
	onEditOptions: () => void;
	onArchive: () => void;
	onRestore: () => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
}

export function DeckRowKebab({
	isPriority,
	isArchived,
	canMoveUp,
	canMoveDown,
	onSetAsPriority,
	onRename,
	onCopy,
	onEditOptions,
	onArchive,
	onRestore,
	onDelete,
	onMoveUp,
	onMoveDown,
}: DeckRowKebabProps): React.JSX.Element {
	return (
		<DecksMenu
			align="end"
			menuClassName="min-w-[12rem]"
			renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
				<button
					ref={triggerRef}
					type="button"
					// Prevent the row's wrapping Link/button from receiving the click.
					onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
					onKeyDown={onKeyDown}
					aria-haspopup="menu"
					aria-expanded={ariaExpanded}
					aria-label="Deck options"
					className={[
						// h-11 w-11 mobile / h-7 w-7 desktop = WCAG 2.5.5 AAA touch
						// target on phones, compact glyph on pointer devices.
						// `active:bg-cream-inset` gives iOS Safari/Chrome tap feedback.
						"ui-motion-colors -mr-1 flex h-11 w-11 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-xs",
						"text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink active:bg-cream-inset",
						"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					].join(" ")}
				>
					<IconMore className="h-4 w-4" />
				</button>
			)}
			renderItems={({ close }) => (
				<>
					{!isArchived && !isPriority && (
						<MenuItem
							leading={<IconFlag className="h-3.5 w-3.5" />}
							onClick={() => { onSetAsPriority(); close(); }}
						>
							Set as priority
						</MenuItem>
					)}
					{!isArchived && (
						<>
							<MenuItem
								onClick={() => { onMoveUp(); close(); }}
								disabled={!canMoveUp}
							>
								Move up
							</MenuItem>
							<MenuItem
								onClick={() => { onMoveDown(); close(); }}
								disabled={!canMoveDown}
							>
								Move down
							</MenuItem>
							<MenuSeparator />
						</>
					)}
					<MenuItem
						leading={<IconEdit className="h-3.5 w-3.5" />}
						onClick={() => { onRename(); close(); }}
					>
						Rename
					</MenuItem>
					<MenuItem
						leading={<IconCopy className="h-3.5 w-3.5" />}
						onClick={() => { onCopy(); close(); }}
					>
						Copy
					</MenuItem>
					<MenuItem
						leading={<IconEdit className="h-3.5 w-3.5" />}
						onClick={() => { onEditOptions(); close(); }}
					>
						Edit options
					</MenuItem>
					<MenuSeparator />
					{isArchived
						? (
								<MenuItem
									leading={<IconReveal className="h-3.5 w-3.5" />}
									onClick={() => { onRestore(); close(); }}
								>
									Restore
								</MenuItem>
							)
						: (
								<MenuItem
									leading={<IconHide className="h-3.5 w-3.5" />}
									onClick={() => { onArchive(); close(); }}
								>
									Archive
								</MenuItem>
							)}
					<MenuItem
						leading={<IconDelete className="h-3.5 w-3.5" />}
						onClick={() => { onDelete(); close(); }}
						danger
					>
						Delete
					</MenuItem>
				</>
			)}
		/>
	);
}

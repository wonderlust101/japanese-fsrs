"use client";

import type { DevPanelRegistration } from "./DevDockContext";
import type { Corner } from "./useDraggableSnap";

import { usePathname } from "next/navigation";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useDevDockContext } from "./DevDockContext";

// ── Dimensions / spacing ─────────────────────────────────────────────────────

const EDGE_PADDING = 16;
const LAUNCHER_SIZE = 40;
const LAUNCHER_GAP = 8;
const DOCK_WIDTH = 360;
const DOCK_HEIGHT_EST = 360;
const NUDGE_STEP = 16;

// ── Geometry ─────────────────────────────────────────────────────────────────

function computeDefaultPosition(launcherCorner: Corner): { x: number; y: number } {
	if (typeof window === "undefined")
		return { x: EDGE_PADDING, y: EDGE_PADDING };
	const w = window.innerWidth;
	const h = window.innerHeight;
	switch (launcherCorner) {
		case "tl":
			return {
				x: EDGE_PADDING,
				y: EDGE_PADDING + LAUNCHER_SIZE + LAUNCHER_GAP,
			};
		case "tr":
			return {
				x: Math.max(EDGE_PADDING, w - EDGE_PADDING - DOCK_WIDTH),
				y: EDGE_PADDING + LAUNCHER_SIZE + LAUNCHER_GAP,
			};
		case "bl":
			return {
				x: EDGE_PADDING,
				y: Math.max(EDGE_PADDING, h - EDGE_PADDING - LAUNCHER_SIZE - LAUNCHER_GAP - DOCK_HEIGHT_EST),
			};
		case "br":
			return {
				x: Math.max(EDGE_PADDING, w - EDGE_PADDING - DOCK_WIDTH),
				y: Math.max(EDGE_PADDING, h - EDGE_PADDING - LAUNCHER_SIZE - LAUNCHER_GAP - DOCK_HEIGHT_EST),
			};
	}
}

function clampToViewport(x: number, y: number, height: number): { x: number; y: number } {
	if (typeof window === "undefined")
		return { x, y };
	const maxX = Math.max(EDGE_PADDING, window.innerWidth - DOCK_WIDTH - EDGE_PADDING);
	const maxY = Math.max(EDGE_PADDING, window.innerHeight - height - EDGE_PADDING);
	return {
		x: Math.min(Math.max(EDGE_PADDING, x), maxX),
		y: Math.min(Math.max(EDGE_PADDING, y), maxY),
	};
}

// ── Component ────────────────────────────────────────────────────────────────

export function DevDock(): React.JSX.Element | null {
	const ctx = useDevDockContext();
	const pathname = usePathname();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const dragOriginRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
	const [livePosition, setLivePosition] = useState<{ x: number; y: number } | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	// Resolve effective position: live (mid-drag) > stored > computed default
	const effectivePosition = livePosition
		?? ctx.position
		?? computeDefaultPosition(ctx.launcherCorner);

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	// Clamp on viewport resize so a previously-good position doesn't trap the
	// dock off-screen after a window shrink.
	useEffect(() => {
		if (!ctx.hydrated)
			return;
		function onResize(): void {
			const h = containerRef.current?.offsetHeight ?? DOCK_HEIGHT_EST;
			const current = ctx.position ?? computeDefaultPosition(ctx.launcherCorner);
			const clamped = clampToViewport(current.x, current.y, h);
			if (clamped.x !== current.x || clamped.y !== current.y) {
				ctx.setPosition(clamped);
			}
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [ctx]);

	// ── Drag ──────────────────────────────────────────────────────────────────

	const startDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
		if (event.button !== 0 && event.pointerType === "mouse")
			return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragOriginRef.current = {
			pointerX: event.clientX,
			pointerY: event.clientY,
			x: effectivePosition.x,
			y: effectivePosition.y,
		};
		setIsDragging(true);
	}, [effectivePosition.x, effectivePosition.y]);

	const onDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
		const origin = dragOriginRef.current;
		if (origin === null)
			return;
		const h = containerRef.current?.offsetHeight ?? DOCK_HEIGHT_EST;
		const nextX = origin.x + (event.clientX - origin.pointerX);
		const nextY = origin.y + (event.clientY - origin.pointerY);
		setLivePosition(clampToViewport(nextX, nextY, h));
	}, []);

	const endDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		if (livePosition !== null) {
			ctx.setPosition(livePosition);
		}
		dragOriginRef.current = null;
		setLivePosition(null);
		setIsDragging(false);
	}, [ctx, livePosition]);

	const onHandleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>): void => {
		const h = containerRef.current?.offsetHeight ?? DOCK_HEIGHT_EST;
		const current = ctx.position ?? computeDefaultPosition(ctx.launcherCorner);
		switch (event.key) {
			case "ArrowUp":
				event.preventDefault();
				ctx.setPosition(clampToViewport(current.x, current.y - NUDGE_STEP, h));
				return;
			case "ArrowDown":
				event.preventDefault();
				ctx.setPosition(clampToViewport(current.x, current.y + NUDGE_STEP, h));
				return;
			case "ArrowLeft":
				event.preventDefault();
				ctx.setPosition(clampToViewport(current.x - NUDGE_STEP, current.y, h));
				return;
			case "ArrowRight":
				event.preventDefault();
				ctx.setPosition(clampToViewport(current.x + NUDGE_STEP, current.y, h));
				return;
			case "Home":
				event.preventDefault();
				ctx.setPosition(null);
		}
	}, [ctx]);

	// Esc closes the dock when focus is inside it, without interfering with the
	// page's own Esc handlers.
	useEffect(() => {
		function onKey(event: KeyboardEvent): void {
			if (event.key !== "Escape")
				return;
			const container = containerRef.current;
			if (container === null)
				return;
			if (event.target instanceof Node && container.contains(event.target)) {
				ctx.setClosed(true);
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [ctx]);

	// ── Render gates ──────────────────────────────────────────────────────────
	//
	// The dock used to also bail out when `panels.length === 0`, but that made
	// the centered-spawn shortcut (⌘⇧0) look broken: the state flipped open
	// but the dock returned null because the page's `useEffect` panel
	// registration hadn't fired yet, or the route happened to have no panel
	// (a stale dev path, an edge route). Now the dock always renders when
	// it's hydrated and not closed; an empty panel list shows a small empty
	// body instead of silently hiding the whole surface.

	if (!ctx.hydrated)
		return null;
	if (ctx.closed)
		return null;

	const panelCount = ctx.panels.length;
	const activeFixtureCount = ctx.panels.reduce((n, p) => {
		if (p.mode !== "fixtures")
			return n;
		const firstKey = p.fixtures[0] !== undefined ? p.fixtures[0].key : "";
		return p.fixture !== firstKey ? n + 1 : n;
	}, 0);
	const headerSummary = panelCount === 0
		? "no panels here"
		: activeFixtureCount === 0
			? `${panelCount} ${panelCount === 1 ? "panel" : "panels"}`
			: `${activeFixtureCount} active`;

	return (
		<div
			ref={containerRef}
			role="region"
			aria-label="Dev dock"
			style={{
				position: "fixed",
				left: `${effectivePosition.x}px`,
				top: `${effectivePosition.y}px`,
				width: `min(${DOCK_WIDTH}px, calc(100vw - ${EDGE_PADDING * 2}px))`,
				maxHeight: `calc(100vh - ${EDGE_PADDING * 2}px)`,
				zIndex: 60,
			}}
			className={cn(
				"flex flex-col rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised",
				"shadow-[0_12px_36px_-16px_rgba(31,26,24,0.55)]",
				"transition-opacity duration-200 ease-out",
			)}
		>
			<DockHeader
				summary={headerSummary}
				collapsed={ctx.collapsed}
				onToggleCollapsed={() => ctx.setCollapsed(!ctx.collapsed)}
				onClose={() => ctx.setClosed(true)}
				onPointerDown={startDrag}
				onPointerMove={onDrag}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onKeyDown={onHandleKeyDown}
				isDragging={isDragging}
			/>

			{!ctx.collapsed && (
				<>
					<div className="flex-1 overflow-y-auto">
						{panelCount === 0
							? <EmptyPanelBody pathname={pathname} />
							: ctx.panels.map((panel, idx) => (
									<PanelSection
										key={panel.id}
										panel={panel}
										isFirst={idx === 0}
										open={ctx.isSectionOpen(panel.id)}
										onToggleOpen={() => ctx.setSectionOpen(panel.id, !ctx.isSectionOpen(panel.id))}
									/>
								))}
					</div>
					<DockFooter pathname={pathname} />
				</>
			)}
		</div>
	);
}

// ── Header ───────────────────────────────────────────────────────────────────

interface DockHeaderProps {
	summary: string;
	collapsed: boolean;
	isDragging: boolean;
	onToggleCollapsed: () => void;
	onClose: () => void;
	onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function DockHeader({
	summary,
	collapsed,
	isDragging,
	onToggleCollapsed,
	onClose,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onPointerCancel,
	onKeyDown,
}: DockHeaderProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-1 border-b border-warm-paper-raised/10 px-2 py-1.5">
			<button
				type="button"
				aria-label="Drag dev dock (arrow keys nudge, Home resets, Esc closes)"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				onKeyDown={onKeyDown}
				className={cn(
					"flex-1 min-w-0 rounded-[2px] px-1.5 py-0.5 text-left select-none touch-none",
					"font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-warm-paper-raised",
					"focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40",
					isDragging ? "cursor-grabbing" : "cursor-grab",
				)}
			>
				<span className="inline-flex items-center gap-2">
					<span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion" />
					<span>Dev tools</span>
					<span className="text-warm-paper-raised/55">·</span>
					<span className="truncate text-warm-paper-raised/70">{summary}</span>
				</span>
			</button>

			<button
				type="button"
				onClick={onToggleCollapsed}
				aria-label={collapsed ? "Expand dev dock" : "Collapse dev dock"}
				aria-expanded={!collapsed}
				className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-warm-paper-raised/70 hover:text-warm-paper-raised hover:bg-warm-paper-raised/10 cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40"
			>
				<Chevron direction={collapsed ? "down" : "up"} />
			</button>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close dev dock"
				className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-warm-paper-raised/70 hover:text-warm-paper-raised hover:bg-warm-paper-raised/10 cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40"
			>
				<CloseIcon />
			</button>
		</div>
	);
}

// ── Section ──────────────────────────────────────────────────────────────────

interface PanelSectionProps {
	panel: DevPanelRegistration;
	open: boolean;
	isFirst: boolean;
	onToggleOpen: () => void;
}

function PanelSection({ panel, open, isFirst, onToggleOpen }: PanelSectionProps): React.JSX.Element {
	return (
		<section
			aria-label={panel.title}
			className={cn("px-3", !isFirst && "border-t border-warm-paper-raised/10")}
		>
			<button
				type="button"
				onClick={onToggleOpen}
				aria-expanded={open}
				className="flex w-full items-center justify-between gap-3 py-2 text-left cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40"
			>
				<span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-warm-paper-raised/65">
					{panel.title}
				</span>
				<span className="flex items-center gap-2 min-w-0">
					{panel.activeLabel !== undefined && (
						<span className="truncate font-mono text-[0.625rem] uppercase tracking-[0.1em] text-warm-paper-raised/75">
							{panel.activeLabel}
						</span>
					)}
					<Chevron direction={open ? "up" : "down"} dim />
				</span>
			</button>

			{open && (
				<div className="pb-3 pt-0.5">
					{panel.mode === "fixtures"
						? <FixtureRadioList panel={panel} />
						: panel.render()}
					{panel.footer !== undefined && (
						<div className="mt-2 border-t border-warm-paper-raised/10 pt-2">
							{panel.footer}
						</div>
					)}
				</div>
			)}
		</section>
	);
}

interface FixtureRadioListProps {
	panel: Extract<DevPanelRegistration, { mode: "fixtures" }>;
}

function FixtureRadioList({ panel }: FixtureRadioListProps): React.JSX.Element {
	return (
		<fieldset className="space-y-0.5" aria-label={`${panel.title} fixtures`}>
			{panel.fixtures.map((spec) => {
				const checked = spec.key === panel.fixture;
				return (
					<label
						key={spec.key}
						className={cn(
							"flex cursor-pointer items-start gap-2 rounded-[2px] px-2 py-1.5 text-[0.7rem]",
							"transition-colors duration-150 ease-out",
							checked
								? "bg-warm-paper-raised/8 text-warm-paper-raised"
								: "text-warm-paper-raised/80 hover:bg-warm-paper-raised/5 hover:text-warm-paper-raised",
						)}
					>
						<input
							type="radio"
							name={`dev-fixture-${panel.id}`}
							value={spec.key}
							checked={checked}
							onChange={() => panel.setFixture(spec.key)}
							className="sr-only"
						/>
						<span
							aria-hidden="true"
							className={cn(
								"mt-[0.32rem] inline-block h-1.5 w-1.5 rounded-full shrink-0",
								checked ? "bg-inari-vermillion" : "bg-warm-paper-raised/25",
							)}
						/>
						<span className="min-w-0 flex-1">
							<span className="block font-medium">{spec.label}</span>
							{spec.description !== undefined && (
								<span className="mt-0.5 block text-[0.625rem] leading-snug text-warm-paper-raised/55">
									{spec.description}
								</span>
							)}
						</span>
					</label>
				);
			})}
		</fieldset>
	);
}

// ── Empty body ───────────────────────────────────────────────────────────────

/**
 * Renders when no panels have registered for the current route. Used to be
 * a silent `return null` at the top of `DevDock`, but that made the
 * centered-spawn shortcut look broken — the user pressed ⌘⇧0, state flipped
 * to "open at center," and nothing visible appeared because the dock bailed.
 * Now the dock always renders chrome; this body explains why the sections
 * are empty so the engineer can chase a missing `useDevStatePanel` call
 * instead of suspecting the dock itself.
 */
function EmptyPanelBody({ pathname }: { pathname: string }): React.JSX.Element {
	return (
		<div className="px-4 py-5 text-[0.6875rem] leading-relaxed text-warm-paper-raised/55">
			<p className="font-mono uppercase tracking-[0.12em] text-warm-paper-raised/70">
				No panels here
			</p>
			<p className="mt-2">
				Nothing has registered a dev panel for this route. Either the route
				is a server-only redirect, or its client component hasn&apos;t
				called
				{" "}
				<code className="font-mono text-warm-paper-raised/80">useDevStatePanel</code>
				{" "}
				/
				{" "}
				<code className="font-mono text-warm-paper-raised/80">useDevPanel</code>
				{" "}
				yet.
			</p>
			<p className="mt-2 truncate font-mono text-warm-paper-raised/40">
				{pathname}
			</p>
		</div>
	);
}

// ── Footer ───────────────────────────────────────────────────────────────────

function DockFooter({ pathname }: { pathname: string }): React.JSX.Element {
	return (
		<div className="border-t border-warm-paper-raised/10 px-3 py-1.5">
			<p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-warm-paper-raised/45">
				<span>⌘⇧D Showcase</span>
				<span className="mx-1.5 text-warm-paper-raised/25">·</span>
				<span>⌘⇧0 Center</span>
				<span className="mx-1.5 text-warm-paper-raised/25">·</span>
				<span>↑↓←→ Nudge</span>
				<span className="mx-1.5 text-warm-paper-raised/25">·</span>
				<span>Home Reset</span>
				<span className="mx-1.5 text-warm-paper-raised/25">·</span>
				<span>Esc Close</span>
			</p>
			<p className="mt-0.5 truncate font-mono text-[0.5625rem] text-warm-paper-raised/35">
				{pathname}
			</p>
		</div>
	);
}

// ── Iconography (avoid lucide; PRODUCT.md commits away from generic stroke icons) ──

function Chevron({ direction, dim }: { direction: "up" | "down"; dim?: boolean }): React.JSX.Element {
	const rotate = direction === "down" ? "rotate-180" : "";
	return (
		<svg
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={cn(rotate, dim === true && "text-warm-paper-raised/55")}
		>
			<path d="M2 6.5 L5 3.5 L8 6.5" />
		</svg>
	);
}

function CloseIcon(): React.JSX.Element {
	return (
		<svg
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			aria-hidden="true"
		>
			<path d="M2 2 L8 8 M8 2 L2 8" />
		</svg>
	);
}

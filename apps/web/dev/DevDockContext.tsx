"use client";

import type { ReactNode } from "react";
import type { Corner } from "./useDraggableSnap";

import {
	createContext,
	use,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DevFixtureSpec<T extends string = string> {
	key: T;
	label: string;
	description?: string;
}

export type DevPanelRegistration
	= | {
		id: string;
		title: string;
		mode: "fixtures";
		fixtures: ReadonlyArray<DevFixtureSpec>;
		fixture: string;
		setFixture: (next: string) => void;
		activeLabel: string;
		footer?: ReactNode;
	}
	| {
		id: string;
		title: string;
		mode: "render";
		render: () => ReactNode;
		activeLabel?: string;
		footer?: ReactNode;
	};

interface RegisterOptions {
	registration: DevPanelRegistration;
}

// ── Persistence ──────────────────────────────────────────────────────────────

const DOCK_CHROME_KEY = "tomo:dev:dock:chrome";

interface DockChromePersisted {
	position: { x: number; y: number } | null;
	collapsed: boolean;
	closed: boolean;
	sections: Record<string, { collapsed: boolean }>;
}

const DOCK_CHROME_DEFAULT: DockChromePersisted = {
	position: null,
	collapsed: false,
	closed: false,
	sections: {},
};

function readDockChrome(): DockChromePersisted {
	if (typeof window === "undefined")
		return DOCK_CHROME_DEFAULT;
	try {
		const raw = window.localStorage.getItem(DOCK_CHROME_KEY);
		if (raw === null)
			return DOCK_CHROME_DEFAULT;
		const parsed = JSON.parse(raw) as Partial<DockChromePersisted>;
		return {
			position: parsed.position ?? null,
			collapsed: typeof parsed.collapsed === "boolean" ? parsed.collapsed : false,
			closed: typeof parsed.closed === "boolean" ? parsed.closed : false,
			sections: parsed.sections ?? {},
		};
	} catch {
		return DOCK_CHROME_DEFAULT;
	}
}

function writeDockChrome(value: DockChromePersisted): void {
	if (typeof window === "undefined")
		return;
	try {
		window.localStorage.setItem(DOCK_CHROME_KEY, JSON.stringify(value));
	} catch {
		// Dev-only surface; localStorage failures don't matter.
	}
}

// ── Context shape ────────────────────────────────────────────────────────────

interface DevDockContextValue {
	// Panel registry
	panels: ReadonlyArray<DevPanelRegistration>;
	register: (opts: RegisterOptions) => void;
	unregister: (id: string) => void;

	// Section collapse state (per panel id)
	isSectionOpen: (panelId: string) => boolean;
	setSectionOpen: (panelId: string, open: boolean) => void;

	// Dock chrome state
	position: { x: number; y: number } | null;
	setPosition: (xy: { x: number; y: number } | null) => void;
	collapsed: boolean;
	setCollapsed: (v: boolean) => void;
	closed: boolean;
	setClosed: (v: boolean) => void;

	// Hydration gate: true once the provider has read localStorage. Lets the
	// dock avoid an SSR-vs-client position flicker by deferring its first paint.
	hydrated: boolean;

	// Helpers
	launcherCorner: Corner;
	resetDock: () => void;
}

const NO_OP_CONTEXT: DevDockContextValue = {
	panels: [],
	register: () => undefined,
	unregister: () => undefined,
	isSectionOpen: () => true,
	setSectionOpen: () => undefined,
	position: null,
	setPosition: () => undefined,
	collapsed: false,
	setCollapsed: () => undefined,
	closed: false,
	setClosed: () => undefined,
	hydrated: false,
	launcherCorner: "br",
	resetDock: () => undefined,
};

const DevDockContext = createContext<DevDockContextValue>(NO_OP_CONTEXT);

export function useDevDockContext(): DevDockContextValue {
	return use(DevDockContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface DevDockProviderProps {
	children: ReactNode;
	launcherCorner: Corner;
}

/**
 * Holds the registry of currently-mounted dev panels plus the dock chrome
 * state (position, collapsed, closed, per-section collapse). The dock and the
 * launcher both read from this provider; pages register through
 * `useDevStatePanel` / `useDevPanel`.
 *
 * Rendered only in development by `DevDockProvider`; in production the
 * default context value is a no-op so `useDevStatePanel` is harmless even
 * when called from a page rendered without the provider in scope.
 */
export function DevDockContextProvider({
	children,
	launcherCorner,
}: DevDockProviderProps): React.JSX.Element {
	const [panels, setPanels] = useState<DevPanelRegistration[]>([]);
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
	const [collapsed, setCollapsed] = useState(false);
	const [closed, setClosed] = useState(false);
	const [sections, setSections] = useState<Record<string, { collapsed: boolean }>>({});
	const [hydrated, setHydrated] = useState(false);
	const sectionsRef = useRef(sections);
	sectionsRef.current = sections;

	// Hydrate dock chrome from localStorage. useLayoutEffect so the first paint
	// after hydration already has the correct position, avoiding a jump.
	useLayoutEffect(() => {
		const stored = readDockChrome();
		setPosition(stored.position); // eslint-disable-line react/set-state-in-effect -- one-shot localStorage hydration on mount; cannot run during SSR render
		setCollapsed(stored.collapsed); // eslint-disable-line react/set-state-in-effect -- one-shot localStorage hydration on mount; cannot run during SSR render
		setClosed(stored.closed); // eslint-disable-line react/set-state-in-effect -- one-shot localStorage hydration on mount; cannot run during SSR render
		setSections(stored.sections); // eslint-disable-line react/set-state-in-effect -- one-shot localStorage hydration on mount; cannot run during SSR render
		setHydrated(true); // eslint-disable-line react/set-state-in-effect -- one-shot localStorage hydration on mount; cannot run during SSR render
	}, []);

	// Debounce chrome writes. Dragging fires ~60 updates per second; without
	// the debounce we'd serialize the same object that many times.
	useEffect(() => {
		if (!hydrated)
			return;
		const handle = window.setTimeout(() => {
			writeDockChrome({ position, collapsed, closed, sections: sectionsRef.current });
		}, 200);
		return () => window.clearTimeout(handle);
	}, [position, collapsed, closed, sections, hydrated]);

	const register = useCallback(({ registration }: RegisterOptions): void => {
		setPanels((prev) => {
			const idx = prev.findIndex(p => p.id === registration.id);
			if (idx === -1)
				return [...prev, registration];
			const next = [...prev];
			next[idx] = registration;
			return next;
		});
	}, []);

	const unregister = useCallback((id: string): void => {
		setPanels(prev => prev.filter(p => p.id !== id));
	}, []);

	const isSectionOpen = useCallback((panelId: string): boolean => {
		const entry = sections[panelId];
		return entry === undefined ? true : !entry.collapsed;
	}, [sections]);

	const setSectionOpen = useCallback((panelId: string, open: boolean): void => {
		setSections((prev) => {
			const current = prev[panelId];
			const nextCollapsed = !open;
			if (current !== undefined && current.collapsed === nextCollapsed)
				return prev;
			return { ...prev, [panelId]: { collapsed: nextCollapsed } };
		});
	}, []);

	const resetDock = useCallback((): void => {
		setPosition(null);
		setCollapsed(false);
		setClosed(false);
	}, []);

	const value = useMemo<DevDockContextValue>(() => ({
		panels,
		register,
		unregister,
		isSectionOpen,
		setSectionOpen,
		position,
		setPosition,
		collapsed,
		setCollapsed,
		closed,
		setClosed,
		hydrated,
		launcherCorner,
		resetDock,
	}), [panels, register, unregister, isSectionOpen, setSectionOpen, position, setPosition, collapsed, setCollapsed, closed, setClosed, hydrated, launcherCorner, resetDock]);

	return (
		<DevDockContext value={value}>
			{children}
		</DevDockContext>
	);
}

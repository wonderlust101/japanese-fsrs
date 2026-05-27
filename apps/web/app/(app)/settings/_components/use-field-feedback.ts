"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Time the inline `✓ saved` tick stays visible before fading out. */
const SAVED_FADE_MS = 1500;

export interface FieldFeedback {
	isSaved: (id: string) => boolean;
	isDirty: (id: string) => boolean;
	getError: (id: string) => string | undefined;
	markSaved: (id: string) => void;
	markDirty: (id: string) => void;
	clearDirty: (id: string) => void;
	markError: (id: string, message: string) => void;
}

/**
 * Per-section field feedback state.
 *
 * Tracks which fields are dirty (uncommitted), recently-saved (the ink-tick
 * is visible), or in error. Sections wire each control to an id and call the
 * matching markSaved / markDirty / markError method on commits and errors.
 *
 * The saved state self-clears after SAVED_FADE_MS so the tick fades out and
 * the field returns to its resting visual register. Dirty and error are
 * explicit, the caller is responsible for clearing them on commit, retry,
 * or success.
 */
export function useFieldFeedback(): FieldFeedback {
	const [saved, setSaved] = useState<Set<string>>(() => new Set());
	const [dirty, setDirty] = useState<Set<string>>(() => new Set());
	const [errors, setErrors] = useState<Map<string, string>>(() => new Map());

	// Live timer registry so the same field can re-trigger its fade without
	// leaving an orphan timer running from the previous save.
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			timers.forEach(t => clearTimeout(t));
			timers.clear();
		};
	}, []);

	const markSaved = useCallback((id: string): void => {
		// The commit moment also clears dirty and any prior error: the field is
		// now at rest.
		setDirty((prev) => {
			if (!prev.has(id))
				return prev;
			const next = new Set(prev); next.delete(id); return next;
		});
		setErrors((prev) => {
			if (!prev.has(id))
				return prev;
			const next = new Map(prev); next.delete(id); return next;
		});
		setSaved(prev => (prev.has(id) ? prev : new Set(prev).add(id)));

		const existing = timersRef.current.get(id);
		if (existing !== undefined)
			clearTimeout(existing);
		const t = setTimeout(() => {
			setSaved((prev) => {
				if (!prev.has(id))
					return prev;
				const next = new Set(prev); next.delete(id); return next;
			});
			timersRef.current.delete(id);
		}, SAVED_FADE_MS);
		timersRef.current.set(id, t);
	}, []);

	const markDirty = useCallback((id: string): void => {
		setSaved((prev) => {
			if (!prev.has(id))
				return prev;
			const next = new Set(prev); next.delete(id); return next;
		});
		setDirty(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
	}, []);

	const clearDirty = useCallback((id: string): void => {
		setDirty((prev) => {
			if (!prev.has(id))
				return prev;
			const next = new Set(prev); next.delete(id); return next;
		});
	}, []);

	const markError = useCallback((id: string, message: string): void => {
		setSaved((prev) => {
			if (!prev.has(id))
				return prev;
			const next = new Set(prev); next.delete(id); return next;
		});
		setErrors(prev => new Map(prev).set(id, message));
	}, []);

	return {
		isSaved: useCallback((id: string) => saved.has(id), [saved]),
		isDirty: useCallback((id: string) => dirty.has(id), [dirty]),
		getError: useCallback((id: string) => errors.get(id), [errors]),
		markSaved,
		markDirty,
		clearDirty,
		markError,
	};
}

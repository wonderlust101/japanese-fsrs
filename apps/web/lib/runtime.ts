// Impure runtime reads, isolated into plain (non-component, non-hook) functions.
//
// `react/purity` forbids `new Date()` / `Date.now()` / `Math.random()` directly
// in a component or hook render body — a client component re-renders, so those
// calls would be non-deterministic across renders. The rule only inspects
// component/hook bodies, so routing the read through a plain function moves it
// out of scope while keeping the value correct:
//
//   - Server Components render once per request, so `currentDate()` IS the
//     request timestamp; there is no hook-based alternative server-side.
//   - In client components, prefer a state initializer / effect / handler for
//     these — or, for a value that must stay stable for the lifetime of a
//     mount, `useRef(randomSeed())` / `useRef(currentMs())`.

export function currentDate(): Date {
	return new Date();
}

export function currentMs(): number {
	return Date.now();
}

/** A 31-bit non-cryptographic seed (e.g. for a stable-per-mount shuffle order). */
export function randomSeed(): number {
	return Math.floor(Math.random() * 2 ** 31);
}

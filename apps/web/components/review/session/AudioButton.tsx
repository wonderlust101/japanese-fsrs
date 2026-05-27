"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface AudioButtonProps {
	src: string | null;
	label: string;
	size?: "sm" | "md";
	autoplay?: boolean;
	muted?: boolean;
}

// Small circular audio button. Idle / playing / muted states all visually
// distinct without color-only signaling. When `src` is null, the button
// renders in a quiet disabled state so the slot is consistent across cards
// with and without audio content.

export function AudioButton({
	src,
	label,
	size = "md",
	autoplay = false,
	muted = false,
}: AudioButtonProps): React.JSX.Element {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const autoplayRef = useRef<boolean>(false);
	const [playing, setPlaying] = useState(false);

	const play = useCallback((): void => {
		const el = audioRef.current;
		if (el === null || src === null || muted)
			return;
		el.currentTime = 0;
		void el.play().catch(() => { /* autoplay block, ignore */ });
	}, [src, muted]);

	useEffect(() => {
		if (!autoplay || autoplayRef.current)
			return;
		if (src === null || muted)
			return;
		autoplayRef.current = true;
		// Defer one tick so layout settles before the audio fires.
		const t = window.setTimeout(play, 60);
		return () => window.clearTimeout(t);
	}, [autoplay, src, muted, play]);

	const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
	const disabled = src === null;

	return (
		<button
			type="button"
			onClick={play}
			disabled={disabled}
			aria-label={muted ? `${label} (muted)` : label}
			title={muted ? "Audio muted for this session" : label}
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-full",
				"border border-soft-hairline transition-colors duration-150",
				dim,
				disabled
					? "bg-cream-inset/40 text-faded-sumi/40 cursor-not-allowed"
					: muted
						? "bg-cream-inset/60 text-faded-sumi/60 cursor-pointer"
						: playing
							? "bg-inari-vermillion text-warm-paper-raised border-inari-vermillion cursor-pointer"
							: "bg-warm-paper-raised text-sumi-ink hover:border-sumi-ink/35 hover:bg-cream-inset/40 cursor-pointer",
				"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink",
			)}
		>
			<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
				{muted
					? (
							<>
								<path d="M2 4.5h2L7 2v8L4 7.5H2v-3z" />
								<path d="M9 3l2 2M11 3L9 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
							</>
						)
					: (
							<path
								d="M2 4.5h2L7 2v8L4 7.5H2v-3zM8.5 4.4a2 2 0 0 1 0 3.2M10 3a3.5 3.5 0 0 1 0 6"
								stroke="currentColor"
								strokeWidth="0.9"
								strokeLinecap="round"
								fill="none"
							/>
						)}
			</svg>
			{!disabled && (
				<audio
					ref={audioRef}
					src={src}
					preload="auto"
					onPlay={() => setPlaying(true)}
					onEnded={() => setPlaying(false)}
					onPause={() => setPlaying(false)}
				/>
			)}
		</button>
	);
}

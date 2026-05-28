"use client";

// Decorative preview art for the Today empty/error module states: the
// empty-state illustrations (shelf, forecast, focus, weak-spots, recent)
// and their error-state counterparts, plus the shared PreviewStage and tone
// tokens. Lifted out of section-primitives.tsx; consumed by EmptyState and
// ConnectionErrorNotice there.

export type EmptyStateVisual = "shelf" | "forecast" | "focus" | "weak-spots" | "recent";
export type ErrorStateVisual = EmptyStateVisual | "connection";

export function EmptyStatePreview({ visual }: { visual: EmptyStateVisual }): React.JSX.Element {
	switch (visual) {
		case "shelf":
			return <ShelfPreview />;
		case "forecast":
			return <ForecastPreview />;
		case "focus":
			return <FocusPreview />;
		case "weak-spots":
			return <WeakSpotsPreview />;
		case "recent":
			return <RecentPreview />;
	}
}

function PreviewStage({
	children,
	className = "",
	tone = "neutral",
}: {
	children: React.ReactNode;
	className?: string;
	tone?: PreviewTone;
}): React.JSX.Element {
	const toneClass = PREVIEW_TONE_CLASSES[tone];

	return (
		<div
			className={[
				"today-empty-preview-stage relative min-h-[7.25rem] w-full overflow-hidden rounded-xs",
				toneClass.frame,
				"px-4 py-3 sm:px-5",
				className,
			].join(" ")}
		>
			<span aria-hidden="true" className={`absolute inset-x-4 top-4 h-px ${toneClass.topRule}`} />
			<span aria-hidden="true" className={`absolute inset-x-6 bottom-4 h-px ${toneClass.bottomRule}`} />
			{children}
		</div>
	);
}

type PreviewTone = "neutral" | "shelf" | "forecast" | "focus" | "weak" | "recent";

const PREVIEW_TONE_CLASSES: Record<PreviewTone, {
	frame: string;
	topRule: string;
	bottomRule: string;
}> = {
	neutral: {
		frame: "border border-soft-hairline/70 bg-cream-inset/35",
		topRule: "bg-soft-hairline/80",
		bottomRule: "bg-soft-hairline/70",
	},
	shelf: {
		frame: "border border-inari-vermillion/12 bg-cream-inset/45",
		topRule: "bg-inari-vermillion/18",
		bottomRule: "bg-aizome-indigo/12",
	},
	forecast: {
		frame: "border border-aizome-indigo/12 bg-cream-inset/45",
		topRule: "bg-aizome-indigo/18",
		bottomRule: "bg-inari-vermillion/12",
	},
	focus: {
		frame: "border border-inari-vermillion/14 bg-cream-inset/45",
		topRule: "bg-inari-vermillion/20",
		bottomRule: "bg-inari-vermillion/14",
	},
	weak: {
		frame: "border border-error/14 bg-error-tint/16",
		topRule: "bg-error/18",
		bottomRule: "bg-inari-vermillion/12",
	},
	recent: {
		frame: "border border-aizome-indigo/12 bg-cream-inset/45",
		topRule: "bg-aizome-indigo/18",
		bottomRule: "bg-inari-vermillion/12",
	},
};

function ShelfPreview(): React.JSX.Element {
	const cards = [
		{
			label: "語",
			className: "-rotate-2 border-inari-vermillion/20 bg-warm-paper-raised/95 text-inari-vermillion",
			delay: "0ms",
		},
		{
			label: "漢",
			className: "translate-y-[-0.25rem] border-inari-vermillion/28 bg-vermillion-wash/55 text-inari-vermillion-deep",
			delay: "40ms",
		},
		{
			label: "文",
			className: "rotate-2 border-aizome-indigo/18 bg-cream-inset/75 text-aizome-indigo",
			delay: "80ms",
		},
	];

	return (
		<PreviewStage tone="shelf">
			<div className="relative z-10 flex h-24 items-end justify-center gap-[clamp(0.45rem,3.5vw,1.25rem)] pt-3">
				{cards.map(card => (
					<span
						key={card.label}
						className={[
							"flex h-[4.75rem] w-[clamp(2.75rem,10vw,3.75rem)] items-center justify-center rounded-xs",
							"today-empty-preview-card border font-display text-xl leading-none",
							card.className,
						].join(" ")}
						style={{ transitionDelay: card.delay }}
					>
						<span lang="ja" className="today-empty-preview-glyph">
							{card.label}
						</span>
					</span>
				))}
			</div>
			<span aria-hidden="true" className="absolute bottom-8 left-8 right-8 h-0.5 bg-aizome-indigo/12" />
		</PreviewStage>
	);
}

function ForecastPreview(): React.JSX.Element {
	const bars = [
		"dashboard-preview-forecast-bar-0",
		"dashboard-preview-forecast-bar-1",
		"dashboard-preview-forecast-bar-2",
		"dashboard-preview-forecast-bar-3",
		"dashboard-preview-forecast-bar-4",
		"dashboard-preview-forecast-bar-5",
		"dashboard-preview-forecast-bar-6",
		"dashboard-preview-forecast-bar-7",
		"dashboard-preview-forecast-bar-8",
		"dashboard-preview-forecast-bar-9",
		"dashboard-preview-forecast-bar-10",
		"dashboard-preview-forecast-bar-11",
		"dashboard-preview-forecast-bar-12",
		"dashboard-preview-forecast-bar-13",
	];

	return (
		<PreviewStage tone="forecast">
			<div className="relative z-10 flex h-20 items-end gap-2 pt-3">
				{bars.map((bar, index) => (
					<span
						key={index}
						className={`today-empty-preview-meter flex-1 rounded-t-[1px] ${bar}`}
						style={{ transitionDelay: `${index * 8}ms` }}
					/>
				))}
			</div>
			<div className="relative z-10 mt-3 grid grid-cols-7 gap-2">
				{["今", "火", "水", "木", "金", "土", "日"].map((label, index) => (
					<span
						key={label}
						lang="ja"
						className={[
							"text-center font-mono text-sm leading-none",
							index === 0 ? "text-inari-vermillion" : "text-faded-sumi",
						].join(" ")}
					>
						{label}
					</span>
				))}
			</div>
		</PreviewStage>
	);
}

function FocusPreview(): React.JSX.Element {
	return (
		<PreviewStage tone="focus">
			<span
				lang="ja"
				aria-hidden="true"
				className="today-empty-preview-accent absolute right-4 top-3 select-none font-display text-glyph leading-none text-inari-vermillion/[0.09]"
			>
				要
			</span>
			<div className="relative z-10 pt-4">
				<p className="font-mono text-sm text-faded-sumi">
					pattern to watch
				</p>
				<div className="mt-4 flex flex-wrap items-baseline gap-3">
					<span lang="ja" className="font-display text-2xl leading-none text-sumi-ink/85">
						払う
					</span>
					<span lang="ja" className="font-mono text-xs tracking-wide text-inari-vermillion/80">
						はらう
					</span>
				</div>
				<div className="mt-5 flex flex-col gap-y-3">
					<span className="block h-1.5 w-11/12 rounded-[1px] bg-soft-hairline/80" />
					<span className="today-empty-preview-accent block h-1.5 w-7/12 rounded-[1px] bg-inari-vermillion/[0.16]" />
					<span className="today-empty-preview-accent block h-1.5 w-9/12 rounded-[1px] bg-inari-vermillion/[0.28] [transition-delay:40ms]" />
				</div>
			</div>
		</PreviewStage>
	);
}

function WeakSpotsPreview(): React.JSX.Element {
	const leechCards = [
		{
			word: "必要",
			misses: "Missed 8x",
			className: "left-1/2 top-8 z-0 -translate-x-[8.9rem] -rotate-[9deg] border-error/16 bg-error-tint/30 text-faded-sumi",
			label: "WeakSpot",
			marker: "bg-error/42",
		},
		{
			word: "違う",
			misses: "Missed 9x",
			className: "left-1/2 top-3 z-20 -translate-x-1/2 border-error/24 bg-error-tint/58 text-sumi-ink",
			label: "WeakSpot",
			marker: "bg-error/72",
		},
		{
			word: "続ける",
			misses: "Missed 7x",
			className: "left-1/2 top-8 z-10 translate-x-[3.75rem] rotate-[9deg] border-error/18 bg-error-tint/38 text-faded-sumi",
			label: "WeakSpot",
			marker: "bg-error/52",
		},
	];

	return (
		<PreviewStage tone="weak" className="min-h-[10.75rem]">
			<div className="relative z-10 mx-auto h-[10.5rem] max-w-[20.5rem] pt-1">
				{leechCards.map(card => (
					<div
						key={card.word}
						aria-hidden="true"
						className={[
							"absolute h-[7.45rem] w-[5.35rem] rounded-xs border",
							card.className,
						].join(" ")}
					>
						<span className={`today-empty-preview-accent absolute inset-x-0 top-0 h-0.5 ${card.marker}`} />
						<span className="absolute left-3 top-3 font-mono text-sm font-medium text-faded-sumi">
							{card.label}
						</span>
						<div className="absolute inset-x-3 top-[3.15rem] flex items-center justify-center">
							<span lang="ja" className="whitespace-nowrap font-display text-lg leading-none text-sumi-ink">
								{card.word}
							</span>
						</div>
						<span className="absolute bottom-3 left-3 right-3 text-center font-mono text-sm font-medium text-inari-vermillion-deep">
							<span className="today-empty-preview-glyph inline-block">
								{card.misses}
							</span>
						</span>
					</div>
				))}
			</div>
		</PreviewStage>
	);
}

function RecentPreview(): React.JSX.Element {
	const days = [
		{ label: "月", size: "h-7", tone: "bg-aizome-indigo/28" },
		{ label: "火", size: "h-10", tone: "bg-aizome-indigo/36" },
		{ label: "水", size: "h-3", tone: "bg-soft-hairline" },
		{ label: "木", size: "h-12", tone: "bg-inari-vermillion/42" },
		{ label: "金", size: "h-8", tone: "bg-aizome-indigo/30" },
		{ label: "土", size: "h-3", tone: "bg-soft-hairline" },
		{ label: "今", size: "h-11", tone: "bg-inari-vermillion/48" },
	];

	return (
		<PreviewStage tone="recent">
			<div className="relative z-10 grid h-20 grid-cols-7 items-end gap-2 pt-3">
				{days.map((day, index) => (
					<span key={day.label} className="flex min-w-0 flex-col items-center gap-2">
						<span
							className={[
								"w-full max-w-12 rounded-t-[1px]",
								"today-empty-preview-meter origin-bottom",
								day.tone,
								day.size,
							].join(" ")}
							style={{ transitionDelay: `${index * 12}ms` }}
						/>
						<span
							lang="ja"
							className={[
								"font-mono text-sm leading-none",
								day.label === "今" ? "text-inari-vermillion" : "text-faded-sumi",
							].join(" ")}
						>
							{day.label}
						</span>
					</span>
				))}
			</div>
		</PreviewStage>
	);
}

export function ErrorSignalPreview({ visual }: { visual: ErrorStateVisual }): React.JSX.Element {
	switch (visual) {
		case "shelf":
			return (
				<ErrorPreviewStage label="shelf paused">
					<div className="relative z-10 flex h-20 items-end justify-center gap-2 pt-5">
						{["語", "漢", "文"].map((label, index) => (
							<span
								key={label}
								lang="ja"
								className={[
									"flex h-14 w-12 items-center justify-center rounded-[1px] border font-display text-lg",
									index === 1
										? "translate-y-[-0.35rem] border-error/40 bg-error-tint text-error-deep"
										: "border-soft-hairline bg-warm-paper-raised text-faded-sumi/70",
								].join(" ")}
							>
								{index === 1 ? "!" : label}
							</span>
						))}
					</div>
				</ErrorPreviewStage>
			);
		case "forecast":
			return (
				<ErrorPreviewStage label="route gap">
					<div className="relative z-10 flex h-20 items-end gap-2 pt-5">
						{[26, 40, 18, 54, 24, 36, 12].map((height, index) => (
							<span
								key={index}
								className={[
									"flex-1 origin-bottom rounded-t-[1px]",
									index === 3 ? "bg-error" : "bg-error/25",
								].join(" ")}
								style={{
									height: `${height}px`,
									opacity: index > 3 ? 0.45 : 0.75,
								}}
							/>
						))}
					</div>
					<span aria-hidden="true" className="absolute left-[46%] top-8 h-10 w-px rotate-12 bg-error-deep/45" />
				</ErrorPreviewStage>
			);
		case "focus":
			return (
				<ErrorPreviewStage label="focus waiting">
					<span
						lang="ja"
						aria-hidden="true"
						className="absolute right-4 top-3 select-none font-display text-glyph leading-none text-error/[0.10]"
					>
						要
					</span>
					<div className="relative z-10 pt-8">
						<span className="font-mono text-sm text-error-deep/70">
							signal unavailable
						</span>
						<div className="mt-4 flex flex-col gap-y-3">
							<span className="block h-1.5 w-11/12 rounded-[1px] bg-error/20" />
							<span className="block h-1.5 w-7/12 rounded-[1px] bg-error/20" />
							<span className="block h-1.5 w-9/12 rounded-[1px] bg-error/45" />
						</div>
					</div>
				</ErrorPreviewStage>
			);
		case "weak-spots":
			return (
				<ErrorPreviewStage label="drill paused">
					<div className="relative z-10 flex h-20 items-center justify-center gap-2 pt-5">
						{["覚", "!", "書"].map((label, index) => (
							<span
								key={`${label}-${index}`}
								lang={label === "!" ? undefined : "ja"}
								className={[
									"flex h-12 w-12 items-center justify-center rounded-[1px] border font-display text-lg",
									label === "!"
										? "border-error/40 bg-error text-warm-paper-raised"
										: "border-error/20 bg-error-tint/45 text-error-deep/70",
								].join(" ")}
							>
								{label}
							</span>
						))}
					</div>
				</ErrorPreviewStage>
			);
		case "recent":
			return (
				<ErrorPreviewStage label="history gap">
					<div className="relative z-10 grid h-20 grid-cols-7 items-end gap-2 pt-5">
						{[7, 10, 4, 12, 8, 3, 9].map((height, index) => (
							<span key={index} className="flex min-w-0 flex-col items-center gap-2">
								<span
									className={[
										"w-full max-w-9 rounded-t-[1px]",
										index === 3 ? "bg-error" : "bg-error/25",
									].join(" ")}
									style={{ height: `${height * 4}px`, opacity: index > 3 ? 0.45 : 0.7 }}
								/>
								<span className={index === 3 ? "h-1.5 w-1.5 rounded-full bg-error" : "h-1.5 w-1.5 rounded-full bg-error/25"} />
							</span>
						))}
					</div>
				</ErrorPreviewStage>
			);
		case "connection":
			return (
				<ErrorPreviewStage label="retry ready">
					<div className="relative z-10 flex h-20 items-center justify-center pt-5">
						<span className="h-px w-16 bg-error/35" />
						<span className="mx-3 flex h-10 w-10 items-center justify-center rounded-xs border border-error/35 bg-error-tint font-mono text-sm font-semibold text-error-deep">
							!
						</span>
						<span className="h-px w-16 border-t border-dashed border-error/45" />
					</div>
				</ErrorPreviewStage>
			);
	}
}

function ErrorPreviewStage({
	children,
	label,
}: {
	children: React.ReactNode;
	label: string;
}): React.JSX.Element {
	return (
		<div
			aria-hidden="true"
			className={[
				"dashboard-error-preview group/error relative min-h-[7.25rem] overflow-hidden rounded-xs",
				"border border-error/20 bg-warm-paper-raised/70 px-4 py-3",
				"today-motion-colors hover:border-error/35 hover:bg-error-tint/35",
			].join(" ")}
		>
			<span className="today-motion-colors absolute inset-x-4 top-4 h-px bg-error/25 group-hover/error:bg-error/35" />
			<span className="today-motion-colors absolute inset-x-6 bottom-4 h-px bg-error/20 group-hover/error:bg-error/30" />
			<span className="today-motion-preview absolute left-4 top-5 flex h-5 w-5 items-center justify-center rounded-full border border-error/35 bg-error-tint font-mono text-sm font-semibold text-error-deep group-hover/error:-translate-y-0.5 group-hover/error:border-error/50">
				!
			</span>
			<span className="today-motion-preview absolute right-4 top-5 font-mono text-sm text-error-deep/65 group-hover/error:text-error-deep">
				{label}
			</span>
			{children}
		</div>
	);
}

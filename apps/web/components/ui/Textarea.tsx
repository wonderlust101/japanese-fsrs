"use client";

import { useId } from "react";

type TextareaScript = "latin" | "kana" | "kanji" | "mixed";

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
	/**
	 * Visible label rendered above the control. Omit when the control is
	 *  rendered inside a wrapper that already provides its own label (e.g.
	 *  `<SettingsField>`); the wrapper's label should reference the textarea
	 *  via `htmlFor` + the `id` prop.
	 */
	label?: string;
	/** Visual height in rows. Defaults to 4. */
	rows?: number;
	error?: string | undefined;
	hint?: string | undefined;
	/** Editorial language tuning. Mirrors `Input`'s `script` prop. */
	script?: TextareaScript;
	/**
	 * When true, the textarea is sized to the available column with generous
	 *  internal padding (sentence-as-block). Default: false.
	 */
	block?: boolean;
	ref?: React.Ref<HTMLTextAreaElement>;
}

function ErrorGlyph(): React.JSX.Element {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1"
			aria-hidden="true"
			className="shrink-0"
		>
			<circle cx="8" cy="8" r="6.5" />
			<path d="M5 5l6 6M11 5l-6 6" strokeLinecap="round" />
		</svg>
	);
}

const scriptConfig: Record<TextareaScript, { lang: string; fontClass: string; spacingClass: string }> = {
	latin: { lang: "en", fontClass: "", spacingClass: "" },
	kana: { lang: "ja", fontClass: "font-japanese", spacingClass: "tracking-[0.025em]" },
	kanji: { lang: "ja", fontClass: "font-japanese", spacingClass: "" },
	mixed: { lang: "ja", fontClass: "font-japanese", spacingClass: "" },
};

export function Textarea({
	label,
	rows = 4,
	error,
	hint,
	script,
	block = false,
	lang: langProp,
	id: idProp,
	className = "",
	ref,
	...rest
}: TextareaProps): React.JSX.Element {
	const generatedId = useId();
	const id = idProp ?? generatedId;
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;

	const describedBy = [error ? errorId : "", hint && !error ? hintId : ""]
		.filter(Boolean)
		.join(" ") || undefined;

	const scriptCfg = script !== undefined ? scriptConfig[script] : null;
	const resolvedLang = langProp ?? scriptCfg?.lang;
	const fontClass = scriptCfg?.fontClass ?? "";
	const spacingClass = scriptCfg?.spacingClass ?? "";

	const padding = block ? "px-4 py-3.5 leading-7" : "px-3 py-2 leading-6";

	return (
		<div className="flex flex-col gap-2">
			{label !== undefined && (
				<label htmlFor={id} className="text-sm font-medium text-sumi-ink/85">
					{label}
				</label>
			)}

			<textarea
				ref={ref}
				id={id}
				rows={rows}
				lang={resolvedLang}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={[
					"w-full bg-cream-inset border rounded-xs resize-y",
					"text-sumi-ink placeholder:text-faded-sumi",
					"ui-motion-colors",
					"focus:outline focus:outline-1 focus:outline-offset-2",
					"disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
					"read-only:border-transparent read-only:bg-warm-paper-raised",
					error
						? "border-error focus:border-error focus:outline-error-deep"
						: "border-soft-hairline hover:border-faded-sumi focus:outline-sumi-ink",
					"text-base",
					padding,
					fontClass,
					spacingClass,
					className,
				].join(" ")}
				{...rest}
			/>

			{hint && !error && (
				<p id={hintId} className="text-sm text-faded-sumi">
					{hint}
				</p>
			)}

			{error && (
				<p id={errorId} role="alert" className="flex items-center gap-2 text-sm text-error">
					<ErrorGlyph />
					<span>{error}</span>
				</p>
			)}
		</div>
	);
}

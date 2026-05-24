import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface DefRowProps {
    label: string;
    description?: ReactNode;
    control: ReactNode;
    /** Optional inline note below the description (e.g. timebox tail behavior). */
    microcopy?: ReactNode;
    /** Indicates the control has deviated from default. Surfaces a soft hairline cue. */
    modified?: boolean;
    htmlFor?: string;
    className?: string;
}

export function DefRow({
                           label,
                           description,
                           control,
                           microcopy,
                           modified,
                           htmlFor,
                           className
                       }: DefRowProps): React.JSX.Element {
    return (
        <div
            className={cn(
                'grid gap-2 border-t border-soft-hairline/70 py-4 first:border-t-0 first:pt-0',
                // Fixed-width control column so every control across the panel
        // right-aligns to the same vertical axis. 25rem fits the widest
        // control in this surface — the 6-segment Timebox toggle with
        // full "5 min" / "10 min" / ... labels — in a single row.
        'sm:grid-cols-[1fr_25rem] sm:gap-x-6 sm:gap-y-1',
                className
            )}
        >
            {/* Label is a single element placed directly in the grid cell —
                no wrapping `<div>`, no `<p>` — so its computed line box
                matches Checkbox.Row's `<span>` label exactly. (A `<p>` here
                introduced extra vertical space between label and description
                versus the checkbox row's tighter rhythm.) */}
            {htmlFor !== undefined ? (
                <label htmlFor={htmlFor} className="min-w-0 text-base font-medium text-sumi-ink">
                    {label}
                    {modified === true && (
                        <>
                            <span
                                aria-hidden="true"
                                className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion align-middle"
                            />
                            <span className="sr-only"> (modified)</span>
                        </>
                    )}
                </label>
            ) : (
                <span className="min-w-0 text-base font-medium text-sumi-ink">
                    {label}
                    {modified === true && (
                        <>
                            <span
                                aria-hidden="true"
                                className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion align-middle"
                            />
                            <span className="sr-only"> (modified)</span>
                        </>
                    )}
                </span>
            )}
            <div className="flex shrink-0 items-center justify-start sm:row-start-1 sm:col-start-2 sm:row-span-full sm:self-center sm:justify-self-end">
                {control}
            </div>
            {description !== undefined && (
                <p className="text-sm leading-relaxed text-faded-sumi sm:row-start-2 sm:col-start-1 sm:max-w-measure">
                    {description}
                </p>
            )}
            {microcopy !== undefined && (
                <p className="text-sm leading-relaxed text-faded-sumi/85 sm:row-start-3 sm:col-start-1 sm:max-w-measure">
                    {microcopy}
                </p>
            )}
        </div>
    );
}

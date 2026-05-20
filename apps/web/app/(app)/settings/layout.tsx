import type { Metadata } from 'next';

import { TopBar } from '@/app/(app)/_components/top-bar';

import { SettingsTabBar } from './_components/settings-rail';

export const metadata: Metadata = {title : 'Settings'};

/**
 * Shared chrome for every /settings/* sub-route.
 *
 * Frame: 1440px maximum content width, matching Insights and the rest
 * of the (app) shell. A horizontal tab bar sticks beneath the TopBar at
 * the same 1440px width; below it the content area runs in a flex row
 * so each leaf section can render an optional `<ContextStrip>` into the
 * right column on `xl` breakpoints.
 *
 * Each leaf page wraps its content in `<SectionShell>`, which provides
 * the content-column max-width and the optional strip slot. The shell
 * is the contract between layout and section, so leaf pages never have
 * to know the layout's flex internals.
 */
export default function SettingsLayout({
                                           children
                                       }: {
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <>
            <TopBar>
                <h1 className="flex-1 font-display text-xl font-medium text-sumi-ink">
                    Settings
                </h1>
            </TopBar>

            <SettingsTabBar/>

            <main className="mx-auto w-full max-w-[1440px] py-8 lg:py-12">
                <div className="flex gap-10 xl:gap-14">
                    {children}
                </div>
            </main>
        </>
    );
}

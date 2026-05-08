import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart2, Library, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getAuthUser } from '@/lib/supabase/get-auth-user'
import { getUserDisplayName } from '@/lib/supabase/user-metadata'
import { TopBar } from '../_components/top-bar'

export const metadata: Metadata = { title: 'Dashboard' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function toDisplayName(email: string | undefined, fullName: string | undefined): string {
  if (fullName) return fullName
  if (email) return email.split('@')[0] ?? 'there'
  return 'there'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-sumi-ink">{children}</h2>
  )
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string
  value: string
  sublabel: string
}) {
  return (
    <div className="bg-surface-raised rounded-[var(--radius-lg)] shadow-card p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-faded-sumi uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-sumi-ink mt-1">{value}</p>
      <p className="text-xs text-faded-sumi">{sublabel}</p>
    </div>
  )
}

function EmptyStateCard({
  Icon,
  headline,
  body,
  cta,
}: {
  Icon: LucideIcon
  headline: string
  body: string
  cta?: { label: string; href: string }
}) {
  return (
    <div className="bg-surface-raised rounded-[var(--radius-lg)] shadow-card p-10 flex flex-col items-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-inset">
        <Icon size={28} strokeWidth={1.5} className="text-faded-sumi" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-sumi-ink">{headline}</p>
      <p className="text-sm text-faded-sumi max-w-xs">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-inari-vermillion hover:text-inari-vermillion hover:underline"
        >
          {cta.label}
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await getAuthUser()

  const greeting = getGreeting()
  const displayName = toDisplayName(user?.email, getUserDisplayName(user))

  // MVP: real due-count query goes here once reviews are wired up
  const dueCount: number = 0

  return (
    <>
      <TopBar>
        <h1 className="text-md font-semibold text-sumi-ink">Dashboard</h1>
      </TopBar>

      {/* surface-base is the page background (warm-paper-base), set globally on body */}
      <div className="p-4 lg:p-6 max-w-[960px] mx-auto space-y-6">

        {/* ── Hero greeting ──────────────────────────────────────────── */}
        <section
          aria-labelledby="greeting-heading"
          className="bg-surface-raised rounded-[var(--radius-lg)] shadow-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h2
              id="greeting-heading"
              className="text-xl font-semibold text-sumi-ink"
            >
              {greeting}, {displayName}!
            </h2>
            <p className="mt-1 text-sm text-faded-sumi">
              {dueCount > 0
                ? `You have ${dueCount} card${dueCount === 1 ? '' : 's'} due today.`
                : "You’re all caught up — no cards due right now."}
            </p>
          </div>

          {/* Placeholder: links to /review once the session is built */}
          <Link
            href="/review"
            className={[
              'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-md)]',
              'text-base font-medium text-warm-paper-raised bg-inari-vermillion transition-all',
              'hover:bg-inari-vermillion-deep active:scale-[0.98] whitespace-nowrap',
              dueCount === 0 ? 'opacity-50 pointer-events-none' : '',
            ].join(' ')}
            aria-disabled={dueCount === 0}
            tabIndex={dueCount === 0 ? -1 : undefined}
          >
            Start Review
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </section>

        {/* ── Today's Progress stats ─────────────────────────────────── */}
        <section aria-label="Today's progress statistics">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Current Streak"
              value="—"
              sublabel="No reviews yet"
            />
            <StatCard
              label="Cards Learned"
              value="0"
              sublabel="Total cards reviewed"
            />
            <StatCard
              label="Retention Rate"
              value="—"
              sublabel="Needs review history"
            />
          </div>
        </section>

        {/* ── Today's Review Breakdown ───────────────────────────────── */}
        <section aria-labelledby="breakdown-heading">
          <SectionHeading>
            <span id="breakdown-heading">Today&apos;s Review Breakdown</span>
          </SectionHeading>
          <div className="mt-3">
            <EmptyStateCard
              Icon={BarChart2}
              headline="No reviews yet today"
              body="Complete a review session to see your daily breakdown of new, learning, review, and relearning cards here."
            />
          </div>
        </section>

        {/* ── Active Decks ───────────────────────────────────────────── */}
        <section aria-labelledby="decks-heading">
          <SectionHeading>
            <span id="decks-heading">Active Decks</span>
          </SectionHeading>
          <div className="mt-3">
            <EmptyStateCard
              Icon={Library}
              headline="No decks yet"
              body="You haven't added any decks. Browse our premade decks to get started in seconds."
              cta={{ label: 'Browse Premade Decks', href: '/decks/browse' }}
            />
          </div>
        </section>

      </div>
    </>
  )
}

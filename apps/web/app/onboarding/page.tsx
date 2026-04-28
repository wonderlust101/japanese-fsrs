'use client'

import { useRouter } from 'next/navigation'

export default function OnboardingWelcomePage() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center gap-10 text-center">
      {/* Illustration — inline SVG, max 160px per UX spec §7.7 */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="120" height="120" rx="28" fill="#EEF2FF" />
        {/* Book */}
        <rect x="28" y="38" width="64" height="48" rx="4" fill="#C7D2FE" />
        <rect x="28" y="38" width="32" height="48" rx="4" fill="#818CF8" />
        <rect x="56" y="40" width="2" height="44" fill="#4F46E5" />
        {/* Japanese character 日 on right page */}
        <text x="68" y="68" fontSize="22" fontWeight="700" fill="#4338CA"
              fontFamily="serif" textAnchor="middle">日</text>
      </svg>

      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-900 leading-tight">
          Welcome to FSRS Japanese
        </h1>
        <p className="mt-3 text-base text-neutral-500 leading-relaxed">
          We'll set up a study plan tailored to your level and goals.
          It only takes a minute.
        </p>
      </div>

      <button
        type="button"
        onClick={() => router.push('/onboarding/level')}
        className="h-12 px-8 rounded-[var(--radius-md)] bg-primary-500 text-white text-base
                   font-medium transition-colors hover:bg-primary-600 active:scale-[0.98]
                   focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200"
      >
        Let's set up your study plan →
      </button>
    </div>
  )
}

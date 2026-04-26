import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | 友日',
    default: '友日',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <span className="text-3xl font-bold text-primary-600 tracking-tight">友日</span>
        <p className="mt-1 text-sm text-neutral-500">AI-Enhanced Japanese SRS</p>
      </div>

      <div className="w-full max-w-sm bg-surface-raised rounded-[var(--radius-xl)] shadow-lg p-8">
        {children}
      </div>
    </div>
  )
}

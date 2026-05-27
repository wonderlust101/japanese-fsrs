import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'

export async function middleware(request: NextRequest) {
  // Start with a passthrough response so we can mutate its cookies.
  let supabaseResponse = NextResponse.next({ request })

  // Untyped against the `Database` schema — auth-only client.
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propagate new cookies onto both the request (for subsequent
          // middleware) and the response (sent back to the browser).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // IMPORTANT: always use getUser(), never getSession().
  // getSession() reads from a client-accessible cookie that could be spoofed.
  // getUser() sends the JWT to Supabase to validate it server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/signup/verify' ||
    pathname === '/forgot-password'
  // The root is the public marketing landing page. Logged-out visitors (and
  // crawlers) must reach it; authenticated users skip the funnel and go to the
  // app. The other public surfaces (/privacy, /terms, /help) are not in the
  // matcher at all, so middleware never runs on them — they are public by
  // default.
  const isRoot = pathname === '/'

  if (user && (isAuthPage || isRoot)) {
    // Authenticated user hitting an auth page or the landing → straight to the app.
    const url = request.nextUrl.clone()
    url.pathname = '/today'
    return NextResponse.redirect(url)
  }

  if (!user && !isAuthPage && !isRoot) {
    // Unauthenticated user hitting a protected route → send to login, carrying
    // the original path+query as `next` so login can return them there after
    // authenticating (instead of always dropping them on /today). The landing
    // (isRoot) is exempt: logged-out visitors fall through and see it.
    const next = request.nextUrl.pathname + request.nextUrl.search
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Root — public marketing landing for logged-out visitors; authenticated
    // users are redirected to /today (handled above).
    '/',
    // Protected (app) routes
    '/today/:path*',
    '/today',
    '/add/:path*',
    '/add',
    '/review/:path*',
    '/decks/:path*',
    '/cards/:path*',
    '/cards',
    '/insights/:path*',
    '/insights',
    '/settings/:path*',
    // Onboarding — requires authentication; unauthenticated users are sent to /login
    '/onboarding/:path*',
    '/onboarding',
    // Auth pages — checked so logged-in users are redirected away from them
    '/login',
    '/signup',
    '/signup/verify',
    '/forgot-password',
  ],
}

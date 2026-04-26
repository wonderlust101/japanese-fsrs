import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Start with a passthrough response so we can mutate its cookies.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
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
    pathname === '/signup/verify'

  if (user && isAuthPage) {
    // Authenticated user hitting an auth page → send straight to the app.
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (!user && !isAuthPage) {
    // Unauthenticated user hitting a protected route → send to login.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Root — unauthenticated users get redirected to /login here instead of
    // taking a two-hop journey: / → /onboarding → /login.
    '/',
    // Protected (app) routes
    '/dashboard/:path*',
    '/review/:path*',
    '/decks/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    // Onboarding — requires authentication; unauthenticated users are sent to /login
    '/onboarding/:path*',
    '/onboarding',
    // Auth pages — checked so logged-in users are redirected away from them
    '/login',
    '/signup',
    '/signup/verify',
  ],
}

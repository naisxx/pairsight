import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import type { AuthOnlySupabaseClient } from '@/lib/supabase/auth-only'
import { FIXED_CSP, NONCE_HEADER, THEME_DEFAULT_HEADER } from '@/lib/csp'

const intlProxy = createIntlMiddleware(routing)

// The landing page, with or without its locale prefix (/, /en).
const LANDING_PATH = new RegExp(`^/(${routing.locales.join('|')})?/?$`)

// The page CSP: the fixed half plus scripts. Only scripts carrying this
// request's nonce run, plus whatever those load ('strict-dynamic'), so an
// injected <script> or inline handler does nothing. Next reads the nonce from
// the request's header and stamps it on its own scripts; next-themes gets it
// from the layout. React's dev build uses eval for its error stacks, so dev
// alone allows it.
function pagePolicy(nonce: string) {
	const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
	return `${FIXED_CSP}; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}; script-src-attr 'none'`
}

// Refreshes the Supabase session cookie on every request, then hands off to
// next-intl's locale routing. Order matters: Supabase's cookie writes have
// to survive whatever next-intl's proxy does next (redirect or rewrite), so
// we run Supabase first and copy its Set-Cookie headers onto whatever
// response next-intl produces — not the other way around.
export default async function proxy(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request })

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

	if (supabaseUrl && supabasePublishableKey) {
		// Typed to the auth surface like the wrappers in src/lib/supabase/ —
		// this is the one other place the SDK is constructed, and it exists
		// only to refresh the session cookie.
		const supabase: AuthOnlySupabaseClient = createServerClient(
			supabaseUrl,
			supabasePublishableKey,
			{
				cookies: {
					getAll() {
						return request.cookies.getAll()
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
						supabaseResponse = NextResponse.next({ request })
						cookiesToSet.forEach(({ name, value, options }) =>
							supabaseResponse.cookies.set(name, value, options)
						)
					}
				}
			}
		)

		// Talking to Supabase here is a real network call — never let it take
		// the whole site down. A landing-page clone with placeholder
		// Supabase env vars, or Supabase itself being briefly unreachable,
		// should still serve pages; it just means the session isn't refreshed
		// on this request.
		try {
			await supabase.auth.getUser()
		} catch {
			// Fail open — see comment above.
		}
	}

	// A fresh nonce per page view: a guessable one would let a script in.
	// Built after Supabase so its cookie writes on `request` come along.
	const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
	const csp = pagePolicy(nonce)
	const requestHeaders = new Headers(request.headers)
	requestHeaders.set(NONCE_HEADER, nonce)
	requestHeaders.set('Content-Security-Policy', csp)
	if (LANDING_PATH.test(request.nextUrl.pathname)) {
		requestHeaders.set(THEME_DEFAULT_HEADER, 'dark')
	} else {
		requestHeaders.delete(THEME_DEFAULT_HEADER)
	}
	// next-intl forwards the headers of the request it's given to the page.
	const intlResponse = intlProxy(new NextRequest(request, { headers: requestHeaders }))
	intlResponse.headers.set('Content-Security-Policy', csp)
	// Copy the whole cookie object, not just (name, value): the options carry
	// httpOnly / secure / sameSite / maxAge / path, and dropping them would
	// downgrade a freshly refreshed session cookie into a permissive one.
	supabaseResponse.cookies.getAll().forEach((cookie) => {
		intlResponse.cookies.set(cookie)
	})

	return intlResponse
}

export const config = {
	// Skip API routes, static files, and Next internals — locale routing
	// only applies to actual pages.
	matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}

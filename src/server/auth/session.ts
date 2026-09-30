import 'server-only'
import { cache } from 'react'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors/app-error'
import { env } from '@/lib/env'

// The signed-in person for this request. `id` is the Supabase auth uuid,
// which is also User.id (docs/rules/auth.md). The session is read once per
// request (cache) and verified with Supabase (getUser, not getSession).
export type SessionUser = { id: string; email: string }

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
	// Same convention as proxy.ts: with Supabase unconfigured (CI's e2e job,
	// a landing-only deploy) nobody can be signed in, so public pages still
	// render and every guarded path sends the visitor to sign-in.
	if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null
	const supabase = await createServerSupabaseClient()
	const {
		data: { user }
	} = await supabase.auth.getUser()
	if (user == null || user.email == null) return null
	return { id: user.id, email: user.email }
})

// The gate for every PairSight action and route: no session, no access.
// Ownership of the specific evaluation is then checked by the store
// (src/server/pairsight/evaluations.ts), which scopes every query to this id.
export async function requireUser(): Promise<SessionUser> {
	const user = await getSessionUser()
	if (user == null)
		throw new AppError('Please sign in to continue.', { status: 401, code: 'unauthorized' })
	return user
}

// Page twin of requireUser: sends a signed-out visitor to sign-in and back.
export async function requireUserOrRedirect(returnTo: string): Promise<SessionUser> {
	const user = await getSessionUser()
	if (user != null) return user
	const locale = await getLocale()
	return redirect({ href: { pathname: '/sign-in', query: { next: returnTo } }, locale })
}

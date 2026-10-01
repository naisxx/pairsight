import 'server-only'
import { cache } from 'react'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors/app-error'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'

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

// The signed-in person with the name they gave at onboarding.
export type AppUser = SessionUser & { name: string }

// The saved full name, read once per request; null until onboarding.
export const getProfileName = cache(async (userId: string): Promise<string | null> => {
	const profile = await db.user.findUnique({ where: { id: userId }, select: { name: true } })
	return profile?.name ?? null
})

// Page twin of requireUser: sends a signed-out visitor to sign-in, and a
// signed-in one who hasn't told us their name to onboarding, then back.
export async function requireUserOrRedirect(returnTo: string): Promise<AppUser> {
	const user = await getSessionUser()
	const locale = await getLocale()
	if (user == null) {
		return redirect({ href: { pathname: '/sign-in', query: { next: returnTo } }, locale })
	}
	const name = await getProfileName(user.id)
	if (name == null) {
		return redirect({ href: { pathname: '/welcome', query: { next: returnTo } }, locale })
	}
	return { ...user, name }
}

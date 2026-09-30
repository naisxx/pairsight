'use server'

import { z } from 'zod'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors/app-error'
import { validatedAction } from '@/server/actions/validated-action'
import { provisionUser } from '@/server/auth/provision-user'

// Email + password against the local Supabase Auth (docs/PairSight-Delivery-Plan.md,
// "Sign-in"). Auth only — the User row is provisioned here, and every other
// byte of data goes through Prisma.

const MIN_PASSWORD_LENGTH = 8
const DEFAULT_AFTER_SIGN_IN = '/evaluations'

const credentials = z.object({
	email: z.string().trim().email(),
	password: z.string().min(MIN_PASSWORD_LENGTH),
	next: z.string().optional()
})

// Only same-site paths: `next` comes from the URL, so anything else would be
// an open redirect.
function safeNext(next: string | undefined): string {
	return next != null && next.startsWith('/') && !next.startsWith('//')
		? next
		: DEFAULT_AFTER_SIGN_IN
}

async function goTo(href: string): Promise<never> {
	const locale = await getLocale()
	return redirect({ href, locale })
}

export const signIn = validatedAction({
	input: credentials,
	handler: async ({ email, password, next }) => {
		const supabase = await createServerSupabaseClient()
		const { data, error } = await supabase.auth.signInWithPassword({ email, password })
		if (error != null || data.user == null) {
			throw new AppError('That email and password don’t match an account.', {
				status: 401,
				code: 'invalid_credentials'
			})
		}
		await provisionUser({ id: data.user.id, email: data.user.email ?? email })
		return goTo(safeNext(next))
	}
})

export const signUp = validatedAction({
	input: credentials,
	handler: async ({ email, password, next }) => {
		const supabase = await createServerSupabaseClient()
		const { data, error } = await supabase.auth.signUp({ email, password })
		if (error != null || data.user == null) {
			throw new AppError(
				error?.code === 'user_already_exists'
					? 'An account with this email already exists. Sign in instead.'
					: 'We couldn’t create that account. Check the email and try again.',
				{ status: 400, code: error?.code ?? 'sign_up_failed' }
			)
		}
		await provisionUser({ id: data.user.id, email: data.user.email ?? email })
		if (data.session == null) return { needsConfirmation: true }
		return goTo(safeNext(next))
	}
})

export const signOut = validatedAction({
	input: z.object({}),
	handler: async () => {
		const supabase = await createServerSupabaseClient()
		await supabase.auth.signOut()
		return goTo('/')
	}
})

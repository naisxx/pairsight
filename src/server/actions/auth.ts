'use server'

import { z } from 'zod'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors/app-error'
import { credentialsSchema } from '@/lib/auth/credentials'
import { profileSchema } from '@/lib/auth/profile'
import { safeNext } from '@/lib/auth/safe-next'
import { db } from '@/server/db/client'
import { requireUser } from '@/server/auth/session'
import { validatedAction } from '@/server/actions/validated-action'
import { provisionUser } from '@/server/auth/provision-user'

// Email + password against the local Supabase Auth (docs/PairSight-Delivery-Plan.md,
// "Sign-in"). Auth only — the User row is provisioned here, and every other
// byte of data goes through Prisma.

async function goTo(href: string): Promise<never> {
	const locale = await getLocale()
	return redirect({ href, locale })
}

export const signIn = validatedAction({
	input: credentialsSchema,
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
	input: credentialsSchema,
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

// Onboarding: saves the full name, then carries on to where the person was
// going. Upsert, so an account whose row was never provisioned still works.
export const saveProfile = validatedAction({
	input: profileSchema,
	handler: async ({ name, next }) => {
		const user = await requireUser()
		await db.user.upsert({
			where: { id: user.id },
			create: { id: user.id, email: user.email, name },
			update: { name }
		})
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

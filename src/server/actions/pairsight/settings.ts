'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { AppError } from '@/lib/errors/app-error'
import { requirePermission } from '@/lib/rbac/context'
import { validatedAction } from '@/server/actions/validated-action'
import {
	canSaveJevConnection,
	removeJevConnection,
	saveJevConnection
} from '@/server/ai/jev-credentials'
import { isOnPrem } from '@/server/deployment'
import { checkJevKey, type KeyCheckFailure } from '@/server/pairsight/jev-key-check'
import { setAdmin, type AdminChangeRefusal } from '@/server/settings/people'

// Settings: the Jev key and address this server's runs use, and on-prem who
// is an admin. Only an admin with settings.manage changes the key, and only
// one with access.manage changes who's an admin. A key is checked with Jev before it's
// saved, and the key itself is never sent back, logged or put in an error:
// every message below is fixed text.

const KEY_MAX_LENGTH = 500
const KEY_MIN_LENGTH = 8

const FAILURE_MESSAGES: Record<KeyCheckFailure, string> = {
	refused: 'Jev didn’t accept this key. Check it was copied in full and try again.',
	unreachable: 'PairSight couldn’t reach Jev at that address. Check the address and try again.',
	unexpected: 'Jev didn’t answer as expected, so the key wasn’t saved. Try again in a moment.'
}

// http(s) only, without a trailing slash: calls go to `${baseUrl}/systemone`.
const baseUrlSchema = z
	.string()
	.trim()
	.url()
	.refine((value) => /^https?:\/\//i.test(value))
	.transform((value) => value.replace(/\/+$/, ''))

export const saveJevConnectionAction = validatedAction({
	input: z.object({
		apiKey: z.string().trim().min(KEY_MIN_LENGTH).max(KEY_MAX_LENGTH),
		baseUrl: baseUrlSchema
	}),
	handler: async ({ apiKey, baseUrl }) => {
		const { user } = await requirePermission('settings.manage')
		// Checked before Jev is asked, so a key that can't be kept costs nothing.
		if (!canSaveJevConnection()) {
			throw new AppError(
				'This server isn’t set up to store a Jev key. Ask whoever installed PairSight.',
				{ status: 409, code: 'cannot_store' }
			)
		}
		const check = await checkJevKey({ apiKey, baseUrl })
		if (!check.ok) {
			throw new AppError(FAILURE_MESSAGES[check.reason], { status: 400, code: check.reason })
		}
		await saveJevConnection({ apiKey, baseUrl, updatedById: user.id })
		revalidatePath('/[locale]', 'layout')
		return { saved: true }
	}
})

export const removeJevConnectionAction = validatedAction({
	input: z.object({}),
	authorize: 'settings.manage',
	handler: async () => {
		await removeJevConnection()
		revalidatePath('/[locale]', 'layout')
		return { removed: true }
	}
})

const ADMIN_REFUSALS: Record<AdminChangeRefusal, string> = {
	self: 'You can’t remove yourself as an admin. Ask another admin to.',
	last_admin: 'There has to be at least one admin, so this one stays.'
}

// On-prem only: hosted, staff seats are managed elsewhere and Settings
// doesn't list anyone.
export const setAdminAction = validatedAction({
	input: z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }),
	handler: async ({ userId, isAdmin }) => {
		if (!isOnPrem()) {
			throw new AppError('That isn’t available here.', { status: 404, code: 'not_found' })
		}
		const { user } = await requirePermission('access.manage')
		const refusal = await setAdmin({ actorId: user.id, userId, isAdmin })
		if (refusal != null) {
			throw new AppError(ADMIN_REFUSALS[refusal], { status: 409, code: refusal })
		}
		revalidatePath('/[locale]/settings', 'page')
		return { isAdmin }
	}
})

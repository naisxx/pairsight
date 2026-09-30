import { z } from 'zod'

// Shared by the sign-in/sign-up form and actions: the form checks it first so
// a bad email or short password gets a specific message without a round
// trip, and the actions still enforce it, since the client can be bypassed.

export const MIN_PASSWORD_LENGTH = 8

export const credentialsSchema = z.object({
	email: z.string().trim().email(),
	password: z.string().min(MIN_PASSWORD_LENGTH),
	next: z.string().optional()
})

import { z } from 'zod'

// The account's full name, asked for once at onboarding (/welcome). Shared
// by the form, which checks it as you type, and the action, which enforces it.

export const FULL_NAME_MAX_LENGTH = 100

export const fullNameSchema = z.string().trim().min(1).max(FULL_NAME_MAX_LENGTH)

export const profileSchema = z.object({
	name: fullNameSchema,
	next: z.string().optional()
})

const INITIALS_COUNT = 2

// "Ana María López" → "AM": the first letter of the first two words.
export function initialsOf(name: string): string {
	return name
		.split(/\s+/)
		.filter((word) => word !== '')
		.slice(0, INITIALS_COUNT)
		.map((word) => word[0] ?? '')
		.join('')
		.toUpperCase()
}

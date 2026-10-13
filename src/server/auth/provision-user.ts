import 'server-only'
import { db, Prisma } from '@/server/db/client'
import { isOnPrem } from '@/server/deployment'
import { log } from '@/server/lib/logger'
import { seatRoleForEmail } from '@/lib/rbac/staff-bootstrap'

// Idempotent user provisioning — call on first sign-in / from an auth webhook
// with the Supabase auth uuid + email. It (1) creates or refreshes the User row
// with id = the Supabase auth uuid (docs/rules/auth.md — never app-generated),
// and (2) if the email's domain maps to a staff seat (src/lib/rbac/staff-bootstrap),
// creates an AdminMember at that role. seatRoleForEmail returns the LOWEST role
// for 8x.social and null for everyone else, so a non-staff user gets a User row
// and no seat. An existing seat is never downgraded here — (re)seating or
// elevation is a deliberate access.manage action, not a side effect of signing in.
// On-prem there's no staff domain: the first account becomes the admin.
export async function provisionUser({ id, email }: { id: string; email: string }): Promise<void> {
	await db.user.upsert({
		where: { id },
		create: { id, email },
		update: { email }
	})

	if (isOnPrem()) {
		await seatFirstAdmin(id)
		return
	}

	const seatRole = seatRoleForEmail(email)
	if (!seatRole) return

	await db.adminMember.upsert({
		where: { userId: id },
		create: { userId: id, role: seatRole },
		update: {}
	})
	log.info('provisioned admin seat', { userId: id, role: seatRole })
}

// On-prem (docs/PairSight-OnPrem.md), whoever creates the first account is
// the admin: there's no staff domain, only the people who installed it. Only
// while no one is: serializable, so two sign-ups at once can't both see "no
// admin yet"; the one that loses the race simply isn't made admin.
async function seatFirstAdmin(userId: string): Promise<void> {
	try {
		const isSeated = await db.$transaction(
			async (tx) => {
				if ((await tx.adminMember.count({ where: { isActive: true } })) > 0) return false
				await tx.adminMember.create({ data: { userId, role: 'super_admin' } })
				return true
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		)
		if (isSeated) log.info('first account made admin', { userId })
	} catch (error) {
		// P2034: another sign-up's transaction won (a write conflict). Anything
		// else is a real failure.
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return
		throw error
	}
}

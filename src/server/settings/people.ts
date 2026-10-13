import 'server-only'
import { db } from '@/server/db/client'

// Who has an account on an on-prem copy, and who is an admin (Settings,
// docs/PairSight-OnPrem.md). There, an admin is one role: the Jev key, and
// who else is an admin. Hosted, staff seats are set elsewhere and none of
// this is shown.

export type Person = {
	id: string
	email: string
	name: string | null
	isAdmin: boolean
}

export async function listPeople(): Promise<Person[]> {
	const users = await db.user.findMany({
		orderBy: { createdAt: 'asc' },
		select: { id: true, email: true, name: true, adminMember: { select: { isActive: true } } }
	})
	return users.map(({ adminMember, ...user }) => ({
		...user,
		isAdmin: adminMember?.isActive === true
	}))
}

export type AdminChangeRefusal = 'self' | 'last_admin'

// Why an admin can't be removed: never yourself (so no one locks themselves
// out by accident) and never the last one (so there's always someone who
// can set the Jev key). Making someone an admin is always allowed.
export function adminChangeRefusal({
	actorId,
	userId,
	isAdmin,
	activeAdmins
}: {
	actorId: string
	userId: string
	isAdmin: boolean
	activeAdmins: number
}): AdminChangeRefusal | null {
	if (isAdmin) return null
	if (userId === actorId) return 'self'
	if (activeAdmins <= 1) return 'last_admin'
	return null
}

export async function setAdmin({
	actorId,
	userId,
	isAdmin
}: {
	actorId: string
	userId: string
	isAdmin: boolean
}): Promise<AdminChangeRefusal | null> {
	return db.$transaction(async (tx) => {
		const activeAdmins = await tx.adminMember.count({ where: { isActive: true } })
		const refusal = adminChangeRefusal({ actorId, userId, isAdmin, activeAdmins })
		if (refusal != null) return refusal
		if (isAdmin) {
			await tx.adminMember.upsert({
				where: { userId },
				create: { userId, role: 'super_admin', grantedById: actorId },
				update: { role: 'super_admin', isActive: true, grantedById: actorId }
			})
		} else {
			await tx.adminMember.deleteMany({ where: { userId } })
		}
		return null
	})
}

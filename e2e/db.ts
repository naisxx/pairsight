import { PrismaClient } from '@prisma/client'

// Direct database access for the PairSight specs, for what has no screen
// hosted: making a test account an admin, and undoing it. The same local
// database the app uses (playwright.config.ts loads its env files when
// E2E_PAIRSIGHT=1).

let client: PrismaClient | null = null

function db(): PrismaClient {
	client ??= new PrismaClient()
	return client
}

// An admin seat (every permission that isn't dangerous, settings.manage
// among them) for the account with this email.
export async function makeAdmin(email: string): Promise<void> {
	const user = await db().user.findUniqueOrThrow({ where: { email } })
	await db().adminMember.upsert({
		where: { userId: user.id },
		create: { userId: user.id, role: 'admin' },
		update: { role: 'admin', isActive: true }
	})
}

export async function removeAdmin(email: string): Promise<void> {
	await db().adminMember.deleteMany({ where: { user: { email } } })
}

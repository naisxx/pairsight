// Which local account owns what a scale script makes: the one given by
// email, or else the account with the most evaluations that isn't an
// end-to-end test account.

import { db } from '../../src/server/db/client.ts'

export async function scaleOwner(email: string | undefined): Promise<string> {
	if (email != null) {
		const user = await db.user.findUnique({ where: { email }, select: { id: true } })
		if (user == null) throw new Error('No local account has that email.')
		return user.id
	}
	const users = await db.user.findMany({
		where: { NOT: { email: { startsWith: 'e2e+' } } },
		select: { id: true }
	})
	const counts = await Promise.all(
		users.map(async (user) => ({
			id: user.id,
			evaluations: await db.evaluation.count({ where: { ownerId: user.id } })
		}))
	)
	const chosen = counts.sort((a, b) => b.evaluations - a.evaluations)[0]
	if (chosen == null) throw new Error('No local account. Sign up first, or pass --email.')
	return chosen.id
}

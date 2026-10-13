import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminChangeRefusal } from './people'

const ME = 'a0000000-0000-4000-8000-000000000001'
const THEM = 'a0000000-0000-4000-8000-000000000002'

test('anyone can be made an admin', () => {
	assert.equal(
		adminChangeRefusal({ actorId: ME, userId: THEM, isAdmin: true, activeAdmins: 1 }),
		null
	)
})

test('an admin can remove another while one stays', () => {
	assert.equal(
		adminChangeRefusal({ actorId: ME, userId: THEM, isAdmin: false, activeAdmins: 2 }),
		null
	)
})

test('never yourself, never the last admin', () => {
	assert.equal(
		adminChangeRefusal({ actorId: ME, userId: ME, isAdmin: false, activeAdmins: 3 }),
		'self'
	)
	assert.equal(
		adminChangeRefusal({ actorId: ME, userId: THEM, isAdmin: false, activeAdmins: 1 }),
		'last_admin'
	)
})

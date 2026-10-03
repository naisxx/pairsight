import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluationWhere, ownerScope, SANDBOX_SCOPE, scopeKey } from './scope'

test('an owner sees only their own live evaluations — never a demo one', () => {
	const where = evaluationWhere(ownerScope('user-1'))
	assert.deepEqual(where, { ownerId: 'user-1', kind: 'live' })
	assert.notEqual(where.kind, 'demo')
})

test('the sandbox sees only the owner-less demo evaluations, and never overrides an id', () => {
	const where = evaluationWhere(SANDBOX_SCOPE)
	assert.deepEqual(where, { ownerId: null, kind: 'demo' })
	// Callers write { id, ...evaluationWhere(scope) }: the id they ask for stays.
	assert.equal({ id: 'chosen', ...where }.id, 'chosen')
})

test('scopes cache under different keys', () => {
	assert.notEqual(scopeKey(ownerScope('a')), scopeKey(ownerScope('b')))
	assert.notEqual(scopeKey(ownerScope('a')), scopeKey(SANDBOX_SCOPE))
})

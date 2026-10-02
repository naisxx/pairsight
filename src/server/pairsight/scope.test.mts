import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SANDBOX_EVALUATION_ID } from '@/lib/pairsight/sandbox'
import { evaluationWhere, ownerScope, SANDBOX_SCOPE, scopeKey } from './scope'

test('an owner sees only their own live evaluations — never the demo one', () => {
	const where = evaluationWhere(ownerScope('user-1'))
	assert.deepEqual(where, { ownerId: 'user-1', kind: 'live' })
	assert.notEqual(where.kind, 'demo')
})

test('the sandbox sees only the one prepared demo evaluation', () => {
	assert.deepEqual(evaluationWhere(SANDBOX_SCOPE), { id: SANDBOX_EVALUATION_ID, kind: 'demo' })
})

test('scopes cache under different keys', () => {
	assert.notEqual(scopeKey(ownerScope('a')), scopeKey(ownerScope('b')))
	assert.notEqual(scopeKey(ownerScope('a')), scopeKey(SANDBOX_SCOPE))
})

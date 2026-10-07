import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseKeyField } from './derived-keys'

test('derived fields are field~transform, and parse back', () => {
	assert.deepEqual(parseKeyField('last_name~sound'), { base: 'last_name', transform: 'sound' })
	assert.deepEqual(parseKeyField('email'), { base: 'email', transform: null })
	assert.throws(() => parseKeyField('name~shout' as never), /Unknown key field/)
})

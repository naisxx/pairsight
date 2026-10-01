import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MESSAGE_FILES } from './messages'

// The messages are read from disk at request time, so nothing at build time
// proves they're there: this does.
test('every locale has a messages file holding a JSON object', () => {
	for (const file of Object.values(MESSAGE_FILES)) {
		const parsed: unknown = JSON.parse(
			readFileSync(path.join(process.cwd(), 'messages', file), 'utf8')
		)
		assert.equal(typeof parsed, 'object', file)
		assert.ok(parsed != null && !Array.isArray(parsed), file)
	}
})

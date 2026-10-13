import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatNoteKind } from './format-note'

test('a value written only in other capitals is named as such', () => {
	assert.equal(formatNoteKind('Iamen Kettle', 'IAMEN KETTLE'), 'capitals')
	assert.equal(formatNoteKind('+44 7700 900123', '07700 900123'), 'other')
	assert.equal(formatNoteKind('Same', 'Same'), 'other')
})

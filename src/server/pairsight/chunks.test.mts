import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunks } from './chunks'

test('a list comes a batch at a time, the last one shorter', () => {
	assert.deepEqual([...chunks([1, 2, 3, 4, 5], 2)], [[1, 2], [3, 4], [5]])
	assert.deepEqual([...chunks([1, 2], 5)], [[1, 2]])
	assert.deepEqual([...chunks([], 3)], [])
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bezier, parseRange, progressAt, rangeTop } from './scroll-scene'

const VIEWPORT = 900

test('a range reads as its two named ends', () => {
	assert.deepEqual(parseRange('contain 34% contain 66%'), {
		start: { name: 'contain', percent: 34 },
		end: { name: 'contain', percent: 66 }
	})
	assert.deepEqual(parseRange(' entry 10%   cover 45% '), {
		start: { name: 'entry', percent: 10 },
		end: { name: 'cover', percent: 45 }
	})
	assert.equal(parseRange('contain 34%'), null)
	assert.equal(parseRange('sideways 0% contain 10%'), null)
})

test('the named ranges place the subject as the spec does', () => {
	const short = 300
	// cover: from its top meeting the bottom edge to its bottom leaving the top.
	assert.equal(rangeTop({ name: 'cover', percent: 0 }, VIEWPORT, short), VIEWPORT)
	assert.equal(rangeTop({ name: 'cover', percent: 100 }, VIEWPORT, short), -short)
	// entry: in until fully inside; exit: from starting to leave until gone.
	assert.equal(rangeTop({ name: 'entry', percent: 100 }, VIEWPORT, short), VIEWPORT - short)
	assert.equal(rangeTop({ name: 'exit', percent: 0 }, VIEWPORT, short), 0)
	// contain, shorter than the viewport: fully inside, bottom edge to top.
	assert.equal(rangeTop({ name: 'contain', percent: 0 }, VIEWPORT, short), VIEWPORT - short)
	assert.equal(rangeTop({ name: 'contain', percent: 100 }, VIEWPORT, short), 0)
})

test('a pinned section plays across the scroll that keeps it filling the screen', () => {
	const story = 6200
	const range = {
		start: { name: 'contain', percent: 0 },
		end: { name: 'contain', percent: 100 }
	} as const
	// Taller than the viewport, contain runs from its top at the top to its
	// bottom at the bottom.
	assert.equal(progressAt(0, range, VIEWPORT, story), 0)
	assert.equal(progressAt(VIEWPORT - story, range, VIEWPORT, story), 1)
	assert.equal(progressAt((VIEWPORT - story) / 2, range, VIEWPORT, story), 0.5)
	// Before and after, it holds at the ends.
	assert.equal(progressAt(500, range, VIEWPORT, story), 0)
	assert.equal(progressAt(-9000, range, VIEWPORT, story), 1)
	// A part of it, 34% to 66% of the way.
	const blind = {
		start: { name: 'contain', percent: 34 },
		end: { name: 'contain', percent: 66 }
	} as const
	assert.ok(Math.abs(progressAt(0.5 * (VIEWPORT - story), blind, VIEWPORT, story) - 0.5) < 1e-9)
})

test('the counter’s easing runs from 0 to 1 and front-loads the drop', () => {
	const easing: [number, number, number, number] = [0.3, 0.5, 0.5, 1]
	assert.ok(Math.abs(bezier(easing, 0)) < 1e-6)
	assert.ok(Math.abs(bezier(easing, 1) - 1) < 1e-6)
	assert.ok(bezier(easing, 0.5) > 0.5)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	categorize,
	DEFAULT_THRESHOLD,
	isLowConfidence,
	MAX_THRESHOLD,
	MIN_THRESHOLD,
	THRESHOLD_PRESETS,
	thresholdPreset
} from './decisions'

test('the threshold is inclusive and all four categories are reachable', () => {
	const threshold = 0.6
	const at = (isVendorMatch: boolean, score: number) =>
		categorize({ isVendorMatch, status: 'succeeded', score, threshold })
	assert.equal(at(true, 0.6), 'both_matched')
	assert.equal(at(true, 0.59), 'vendor_only')
	assert.equal(at(false, 0.9), 'pairsight_only')
	assert.equal(at(false, 0.1), 'neither_matched')
})

test('pending, running and failed pairs are never categorized — never a nonmatch', () => {
	for (const status of ['pending', 'running', 'failed'] as const) {
		for (const isVendorMatch of [true, false]) {
			assert.equal(categorize({ isVendorMatch, status, score: null, threshold: 0.5 }), 'incomplete')
		}
	}
	assert.equal(
		categorize({ isVendorMatch: false, status: 'failed', score: 0.1, threshold: 0.5 }),
		'incomplete'
	)
})

test('low confidence is a band around the threshold', () => {
	assert.equal(isLowConfidence({ score: 0.55, threshold: 0.5 }), true)
	assert.equal(isLowConfidence({ score: 0.9, threshold: 0.5 }), false)
})

test('a threshold is named by its preset, or is custom', () => {
	assert.equal(thresholdPreset(0.35), 'lenient')
	assert.equal(thresholdPreset(DEFAULT_THRESHOLD), 'balanced')
	assert.equal(thresholdPreset(0.7), 'strict')
	assert.equal(thresholdPreset(0.62), null)
	// Every preset sits inside the bounds a custom value is held to.
	for (const value of Object.values(THRESHOLD_PRESETS)) {
		assert.ok(value >= MIN_THRESHOLD && value <= MAX_THRESHOLD)
	}
})

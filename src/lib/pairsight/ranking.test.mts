import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyCounts, type VendorMetrics } from './metrics'
import { leadingVendorId, rankVendors, verdictOf } from './ranking'

function metrics(f1: number | null, precision: number | null, agreed = 0): VendorMetrics {
	const counts = emptyCounts()
	counts.neither_matched = agreed
	return {
		counts,
		total: agreed,
		assessed: agreed,
		pending: 0,
		failed: 0,
		tp: 0,
		fp: 0,
		fn: 0,
		precision,
		recall: null,
		f1
	}
}

test('vendors rank by overall score, correct merges breaking ties', () => {
	const ranked = rankVendors([
		{ id: 'a', metrics: metrics(0.8, 0.9) },
		{ id: 'b', metrics: metrics(0.81, 0.7) },
		{ id: 'c', metrics: metrics(0.8, 0.95) },
		{ id: 'd', metrics: metrics(null, null) }
	])
	assert.deepEqual(
		ranked.map((vendor) => [vendor.id, vendor.rank]),
		[
			['b', 1],
			['c', 2],
			['a', 3],
			['d', null]
		]
	)
})

test('the leader is the best overall score, even when another agreed with Jev more often', () => {
	// The demo's case: Northwind agreed on more pairs (mostly "both say
	// different"), Clearline scores higher overall.
	assert.equal(
		leadingVendorId([
			{ id: 'northwind', metrics: metrics(0.8, 0.854, 198) },
			{ id: 'clearline', metrics: metrics(0.812, 0.749, 192) }
		]),
		'clearline'
	)
})

test('no leader with one vendor, no overall score, or a full tie', () => {
	assert.equal(leadingVendorId([{ id: 'a', metrics: metrics(0.9, 0.9) }]), null)
	assert.equal(
		leadingVendorId([
			{ id: 'a', metrics: metrics(null, null) },
			{ id: 'b', metrics: metrics(null, null) }
		]),
		null
	)
	assert.equal(
		leadingVendorId([
			{ id: 'a', metrics: metrics(0.8, 0.9) },
			{ id: 'b', metrics: metrics(0.8, 0.9) }
		]),
		null
	)
	// Same overall score, but fewer wrong merges: a real leader.
	assert.equal(
		leadingVendorId([
			{ id: 'a', metrics: metrics(0.8, 0.9) },
			{ id: 'b', metrics: metrics(0.8, 0.95) }
		]),
		'b'
	)
})

test('the verdict leads with the best overall score, and says when it is close or a tie', () => {
	const northwind = { id: 'northwind', metrics: metrics(0.8, 0.854, 198) }
	const clearline = { id: 'clearline', metrics: metrics(0.812, 0.749, 192) }
	// The demo: 1.2 points apart is too close to call a win.
	const close = verdictOf([northwind, clearline])
	assert.equal(close.kind, 'close')
	assert.equal(close.kind === 'close' && close.lead.id, 'clearline')
	// The dashboard's other demo: 7.7 points apart is a lead.
	const atlas = { id: 'atlas', metrics: metrics(0.786, 0.782) }
	const meridian = { id: 'meridian', metrics: metrics(0.709, 0.887) }
	const lead = verdictOf([meridian, atlas])
	assert.equal(lead.kind, 'lead')
	assert.equal(lead.kind === 'lead' && lead.lead.id, 'atlas')
	// Right at the gap is a lead; just under it is close.
	assert.equal(verdictOf([northwind, { id: 'z', metrics: metrics(0.82, 0.8) }]).kind, 'lead')
	assert.equal(verdictOf([northwind, { id: 'z', metrics: metrics(0.819, 0.8) }]).kind, 'close')
	assert.equal(verdictOf([northwind]).kind, 'single')
	assert.equal(verdictOf([{ id: 'x', metrics: metrics(null, null) }]).kind, 'none')
	assert.equal(verdictOf([northwind, { ...northwind, id: 'twin' }]).kind, 'tie')
	// Only one vendor has a score: it's reported on its own.
	assert.equal(verdictOf([northwind, { id: 'y', metrics: metrics(null, null) }]).kind, 'single')
})

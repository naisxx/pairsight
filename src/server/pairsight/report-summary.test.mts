import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyCounts, type SensitivityPoint, type VendorMetrics } from '@/lib/pairsight/metrics'
import { buildRows } from './result-rows'
import { summarizePairs, type SummaryPair } from './result-overview'
import {
	buildReport,
	headToHead,
	leadRange,
	leaders,
	rankVendors,
	reportExample,
	type ReportRecord
} from './report-summary'

function metrics({
	f1,
	precision,
	recall
}: {
	f1: number | null
	precision: number | null
	recall: number | null
}): VendorMetrics {
	return {
		counts: emptyCounts(),
		total: 0,
		assessed: 0,
		pending: 0,
		failed: 0,
		tp: 0,
		fp: 0,
		fn: 0,
		precision,
		recall,
		f1
	}
}

const vendor = (id: string, values: Parameters<typeof metrics>[0]) => ({
	id,
	name: id.toUpperCase(),
	metrics: metrics(values)
})

test('vendors rank by F1, precision breaking ties; one with no F1 is listed last, unranked', () => {
	const ranked = rankVendors([
		vendor('a', { f1: 0.6, precision: 0.5, recall: 0.75 }),
		vendor('b', { f1: null, precision: null, recall: 0 }),
		vendor('c', { f1: 0.6, precision: 0.9, recall: 0.45 }),
		vendor('d', { f1: 0.8, precision: 0.8, recall: 0.8 })
	])
	assert.deepEqual(
		ranked.map((entry) => [entry.id, entry.rank]),
		[
			['d', 1],
			['c', 2],
			['a', 3],
			['b', null]
		]
	)
})

test('the safest and most complete vendors are named only when they differ from the best', () => {
	assert.deepEqual(
		leaders([
			vendor('a', { f1: 0.8, precision: 0.7, recall: 0.9 }),
			vendor('b', { f1: 0.7, precision: 0.95, recall: 0.55 })
		]),
		{ best: 'a', safest: 'b', mostComplete: 'a' }
	)
	// A tie on precision goes to the better-ranked vendor.
	assert.deepEqual(
		leaders([
			vendor('b', { f1: 0.7, precision: 0.9, recall: 0.55 }),
			vendor('a', { f1: 0.8, precision: 0.9, recall: 0.7 })
		]),
		{ best: 'a', safest: 'a', mostComplete: 'a' }
	)
	assert.deepEqual(leaders([vendor('a', { f1: null, precision: null, recall: null })]), {
		best: null,
		safest: null,
		mostComplete: null
	})
})

// F1 at 0.05, 0.10 … 0.95, from a list of values (nulls where there's nothing to compare).
function curve(values: Array<number | null>): SensitivityPoint[] {
	return values.map((f1, index) => ({
		threshold: (index + 1) / 20,
		precision: f1,
		recall: f1,
		f1,
		matches: 0
	}))
}

test('the lead range covers every threshold when one vendor always leads', () => {
	const range = leadRange(
		[
			{ id: 'a', sensitivity: curve(Array(19).fill(0.8)) },
			{ id: 'b', sensitivity: curve(Array(19).fill(0.5)) }
		],
		0.5
	)
	assert.deepEqual(range, { leader: 'a', from: 0.05, to: 0.95, below: null, above: null })
})

test('the lead range says who leads beyond it when the leader changes', () => {
	// a leads from 0.30 to 0.70; b leads below and above that.
	const a = Array.from({ length: 19 }, (_, index) => (index >= 5 && index <= 13 ? 0.8 : 0.4))
	const range = leadRange(
		[
			{ id: 'a', sensitivity: curve(a) },
			{ id: 'b', sensitivity: curve(Array(19).fill(0.6)) }
		],
		0.5
	)
	assert.deepEqual(range, {
		leader: 'a',
		from: 0.3,
		to: 0.7,
		below: { threshold: 0.25, leader: 'b' },
		above: { threshold: 0.75, leader: 'b' }
	})
	assert.equal(leadRange([{ id: 'a', sensitivity: curve(a) }], 0.5), null)
})

const judged = (score: number) => ({ status: 'succeeded' as const, score, errorCode: null })
type Assessment = SummaryPair['assessment'] & { errorCode: string | null }
let pairId = 0
function pair(a: string, b: string, matchedBy: string[], assessment: Assessment) {
	pairId++
	return {
		id: `p${pairId}`,
		recordAId: a,
		recordBId: b,
		ruleIds: ['email'],
		matchedByExportIds: matchedBy,
		assessment
	}
}

const columnRoles = { name: 'full_name', email: 'email' } as const

function summaryOf(pairs: Array<ReturnType<typeof pair>>, vendorIds: string[]) {
	return summarizePairs({
		pairs,
		records,
		vendorIds,
		threshold: 0.5,
		fuzzyRuleIds: new Set(),
		columnRoles,
		country: 'US'
	})
}

test('head to head counts only the judged pairs one vendor matched and the other did not', () => {
	const pairs = [
		pair('r1', 'r2', ['a'], judged(0.9)), // only a matched, Jev says same: a
		pair('r1', 'r3', ['a'], judged(0.1)), // only a matched, Jev says different: b
		pair('r2', 'r3', ['b'], judged(0.2)), // only b matched, Jev says different: a
		pair('r3', 'r4', ['a', 'b'], judged(0.9)), // both matched: not counted
		pair('r4', 'r1', ['b'], { status: 'failed', score: null, errorCode: 'http_500' })
	]
	assert.deepEqual(headToHead(summaryOf(pairs, ['a', 'b']), [{ id: 'a' }, { id: 'b' }]), [
		{ a: 'a', b: 'b', total: 3, sidedWithA: 2, sidedWithB: 1 }
	])
})

const records = new Map<string, ReportRecord>(
	[
		['r1', 'Jane Smith', 'jane@x.test'],
		['r2', 'Jane Smith', 'jane@x.test'],
		['r3', 'Jane Smyth', 'other@x.test'],
		['r4', 'Bo Chen', 'bo@x.test']
	].map(([id, name, email]) => [
		id,
		{ id, reference: id.toUpperCase(), label: name, values: { name, email } }
	])
)

test('the report ranks vendors, finds their worst disagreements and compares each field', () => {
	const pairs = [
		pair('r1', 'r2', ['a', 'b'], judged(0.95)),
		pair('r1', 'r3', ['b'], judged(0.05)),
		pair('r2', 'r3', [], judged(0.8)),
		pair('r3', 'r4', [], { status: 'pending', score: null, errorCode: null })
	]
	const vendors = [
		{ id: 'a', name: 'A' },
		{ id: 'b', name: 'B' },
		{ id: 'c', name: 'C' }
	]
	const summary = summaryOf(pairs, ['a', 'b', 'c'])
	// The summary's top disagreements as rows, as report.ts reads them.
	const examples = Object.fromEntries(
		vendors.map(({ id }) => {
			const rows = buildRows({ pairs, records, threshold: 0.5, vendorId: id })
			const pick = (ids: string[]) =>
				ids.flatMap((pairId) => rows.filter((row) => row.id === pairId))
			const top = summary.top[id] ?? { missed: [], merges: [] }
			const example = (row: (typeof rows)[number]) =>
				reportExample({ row, records, columnRoles, country: 'US' })
			return [
				id,
				{ merges: pick(top.merges).flatMap(example), misses: pick(top.missed).flatMap(example) }
			]
		})
	)
	const report = buildReport({ summary, vendors, examples })
	assert.deepEqual(
		report.vendors.map((entry) => [entry.id, entry.rank, entry.metrics.precision]),
		[
			['a', 1, 1],
			['b', 2, 0.5],
			['c', null, null]
		]
	)
	assert.deepEqual(report.leaders, { best: 'a', safest: 'a', mostComplete: 'a' })
	assert.equal(report.pairs.counts.incomplete, 1)
	assert.equal(report.fromRules, 4)
	// No fuzzy rules in this run, so no hard cases.
	assert.equal(report.hardCases.found, 0)

	const b = report.vendors.find((entry) => entry.id === 'b')
	const merge = b?.examples.merges[0]
	assert.equal(merge?.recordA.reference, 'R1')
	assert.equal(merge?.recordB.reference, 'R3')
	assert.deepEqual(
		merge?.fields.map((field) => [field.role, field.comparison]),
		[
			['full_name', 'different'],
			['email', 'different']
		]
	)
	assert.equal(b?.examples.misses[0]?.score, 0.8)
	assert.deepEqual(
		report.headToHead.map((match) => [match.a, match.b, match.total]),
		[
			['a', 'b', 1],
			['a', 'c', 1],
			['b', 'c', 2]
		]
	)
})

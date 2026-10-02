import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFindings, type FindingsLabels, type FindingsPair } from './findings-table'

// Labels as their own keys, so the table's words are easy to read here.
const labels: FindingsLabels = {
	recordA: 'A',
	recordB: 'B',
	field: (side, role) => `${side}.${role}`,
	jevStatus: 'status',
	jevScore: 'score',
	jevModel: 'model',
	assessedAt: 'at',
	failure: 'failure',
	decision: 'decision',
	lowConfidence: 'low',
	foundBy: 'found',
	vendorDecision: (vendor) => `${vendor}.decision`,
	vendorCategory: (vendor) => `${vendor}.category`,
	status: (status) => status,
	failureReason: (reason) => `why:${reason}`,
	match: 'match',
	noMatch: 'no match',
	incomplete: 'incomplete',
	yes: 'yes',
	no: 'no',
	matched: 'matched',
	notMatched: 'not matched',
	addedByVendor: 'by vendor',
	category: (category) => category,
	rule: (ruleId) => `rule:${ruleId}`
}

const records = new Map([
	['r1', { reference: 'R1', values: { id: 'R1', name: 'Jane', email: 'j@x.test', note: 'n' } }],
	['r2', { reference: 'R2', values: { id: 'R2', name: 'Jane', email: '', note: 'n' } }],
	['r10', { reference: 'R10', values: { id: 'R10', name: 'Bo', email: 'b@x.test', note: 'n' } }]
])
const columnRoles = { name: 'full_name', email: 'email', note: 'other' } as const
const vendors = [
	{ id: 'va', name: 'Vendor A' },
	{ id: 'vb', name: 'Vendor B' }
]
const judged = (score: number) => ({
	status: 'succeeded' as const,
	score,
	errorCode: null,
	modelReported: 'jev-1',
	completedAt: new Date('2026-10-02T10:00:00Z')
})

test('one row per pair, in reference order, with only the mapped fields', () => {
	const pairs: FindingsPair[] = [
		{
			recordAId: 'r2',
			recordBId: 'r10',
			ruleIds: ['email'],
			matchedByExportIds: [],
			assessment: judged(0.2)
		},
		{
			recordAId: 'r1',
			recordBId: 'r2',
			ruleIds: ['email', 'name'],
			matchedByExportIds: ['va'],
			assessment: judged(0.92)
		}
	]
	const table = buildFindings({ pairs, records, columnRoles, vendors, threshold: 0.5, labels })
	assert.deepEqual(table.headers, [
		'A',
		'B',
		'A.full_name',
		'B.full_name',
		'A.email',
		'B.email',
		'status',
		'score',
		'model',
		'at',
		'failure',
		'decision',
		'low',
		'found',
		'Vendor A.decision',
		'Vendor A.category',
		'Vendor B.decision',
		'Vendor B.category'
	])
	assert.deepEqual(
		table.rows.map((row) => [row[0], row[1]]),
		[
			['R1', 'R2'],
			['R2', 'R10']
		]
	)
	assert.deepEqual(table.rows[0], [
		'R1',
		'R2',
		'Jane',
		'Jane',
		'j@x.test',
		'',
		'succeeded',
		'0.92',
		'jev-1',
		'2026-10-02T10:00:00.000Z',
		'',
		'match',
		'no',
		'rule:email; rule:name',
		'matched',
		'both_matched',
		'not matched',
		'pairsight_only'
	])
	assert.equal(table.rows[1]?.[11], 'no match')
	assert.deepEqual(table.rows[1]?.slice(-4), [
		'not matched',
		'neither_matched',
		'not matched',
		'neither_matched'
	])
})

test('a failed pair is incomplete for everyone, with why; a vendor-only pair says so', () => {
	const pairs: FindingsPair[] = [
		{
			recordAId: 'r1',
			recordBId: 'r10',
			ruleIds: [],
			matchedByExportIds: ['vb'],
			assessment: {
				status: 'failed',
				score: null,
				errorCode: 'http_422',
				modelReported: null,
				completedAt: null
			}
		}
	]
	const [row] = buildFindings({ pairs, records, columnRoles, vendors, threshold: 0.5, labels }).rows
	assert.deepEqual(row?.slice(6), [
		'failed',
		'',
		'',
		'',
		'why:rejected',
		'incomplete',
		'no',
		'by vendor',
		'not matched',
		'incomplete',
		'matched',
		'incomplete'
	])
})

test('a score near the threshold is flagged low confidence', () => {
	const pairs: FindingsPair[] = [
		{
			recordAId: 'r1',
			recordBId: 'r2',
			ruleIds: ['email'],
			matchedByExportIds: [],
			assessment: judged(0.55)
		}
	]
	const [row] = buildFindings({ pairs, records, columnRoles, vendors, threshold: 0.5, labels }).rows
	assert.equal(row?.[12], 'yes')
})

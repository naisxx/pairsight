import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SANDBOX_EVALUATION_ID } from './sandbox'
import { SANDBOX_ID_KIND, sandboxId, sandboxSnapshotSchema } from './sandbox-snapshot'

test('the committed sandbox snapshot is valid and self-consistent', () => {
	const snapshot = sandboxSnapshotSchema.parse(
		JSON.parse(readFileSync('prisma/demo/sandbox-snapshot.json', 'utf8'))
	)
	const references = new Set(snapshot.dataset.records.map((record) => record.reference))
	for (const pair of snapshot.run.pairs) {
		assert.ok(pair.records.every((reference) => references.has(reference)))
		assert.ok(pair.matchedBy.every((index) => index < snapshot.vendors.length))
	}
	for (const vendor of snapshot.vendors) {
		assert.ok(vendor.matches.flat().every((reference) => references.has(reference)))
	}
	// A prepared run never has failures to retry.
	assert.ok(snapshot.run.pairs.every((pair) => pair.assessment.status === 'succeeded'))
})

test('sandbox ids are fixed, distinct by kind, and the evaluation id matches', () => {
	assert.equal(sandboxId(SANDBOX_ID_KIND.evaluation, 1), SANDBOX_EVALUATION_ID)
	assert.notEqual(sandboxId(SANDBOX_ID_KIND.record, 1), sandboxId(SANDBOX_ID_KIND.vendor, 1))
	assert.match(sandboxId(SANDBOX_ID_KIND.runPair, 255), /^[0-9a-f-]{36}$/)
})

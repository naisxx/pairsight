import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ENTITY_TYPES } from './entity-types'
import { SANDBOX_EVALUATION_IDS } from './sandbox'
import {
	SANDBOX_ID_KIND,
	SANDBOX_SNAPSHOTS,
	sandboxId,
	sandboxSnapshotSchema
} from './sandbox-snapshot'

test('every committed sandbox snapshot is valid, self-consistent and of its own type', () => {
	for (const type of ENTITY_TYPES) {
		const snapshot = sandboxSnapshotSchema.parse(
			JSON.parse(readFileSync(SANDBOX_SNAPSHOTS[type], 'utf8'))
		)
		assert.equal(snapshot.evaluation.entityType, type)
		checkSnapshot(snapshot)
	}
})

function checkSnapshot(snapshot: ReturnType<typeof sandboxSnapshotSchema.parse>) {
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
}

test('sandbox ids are fixed, distinct by kind, and the evaluation id matches', () => {
	for (const type of ENTITY_TYPES) {
		assert.equal(sandboxId(SANDBOX_ID_KIND.evaluation, 1, type), SANDBOX_EVALUATION_IDS[type])
	}
	// People keep the ids they had before there were three sandboxes.
	assert.equal(sandboxId(SANDBOX_ID_KIND.evaluation, 1), '5a4db0c0-0000-4000-8000-000000000001')
	assert.notEqual(
		sandboxId(SANDBOX_ID_KIND.record, 1, 'company'),
		sandboxId(SANDBOX_ID_KIND.record, 1, 'product')
	)
	assert.notEqual(sandboxId(SANDBOX_ID_KIND.record, 1), sandboxId(SANDBOX_ID_KIND.vendor, 1))
	assert.match(sandboxId(SANDBOX_ID_KIND.runPair, 255), /^[0-9a-f-]{36}$/)
})

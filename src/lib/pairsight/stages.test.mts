import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	activeStage,
	evaluationStatus,
	landingStage,
	stageHref,
	stageStates,
	type RunStatus,
	type StageInput
} from './stages'

const fresh: StageInput = { hasRecords: false, hasVendors: false, latestRun: null }
const withRun = (status: RunStatus): StageInput => ({
	hasRecords: true,
	hasVendors: true,
	latestRun: { id: 'run-1', status }
})
const states = (input: StageInput) => stageStates(input).map((stage) => stage.state)

test('a new evaluation starts at Records with everything after it locked', () => {
	assert.deepEqual(states(fresh), ['active', 'locked', 'locked', 'locked', 'locked'])
	assert.equal(evaluationStatus(fresh), 'draft')
	assert.equal(activeStage(stageStates(fresh)), 'records')
})

test('records unlock vendors and rules; a vendor too makes it ready to run', () => {
	const recordsOnly = { ...fresh, hasRecords: true }
	assert.deepEqual(states(recordsOnly), ['done', 'active', 'next', 'locked', 'locked'])
	assert.equal(evaluationStatus(recordsOnly), 'draft')

	const ready = { ...recordsOnly, hasVendors: true }
	assert.deepEqual(states(ready), ['done', 'done', 'done', 'active', 'locked'])
	assert.equal(evaluationStatus(ready), 'readyToRun')
})

test('an unfinished vendor keeps Vendors open without locking what follows', () => {
	const input = { hasRecords: true, hasVendors: true, hasUnfinishedVendors: true, latestRun: null }
	assert.deepEqual(states(input), ['done', 'active', 'done', 'next', 'locked'])
	assert.equal(evaluationStatus(input), 'readyToRun')
})

// Runs aren't a stage (they're in the Runs centre): while one goes, its
// results are where the work is.
test('a running run makes Results the active stage, and sets the status', () => {
	assert.deepEqual(states(withRun('running')), ['done', 'done', 'done', 'done', 'active'])
	assert.equal(evaluationStatus(withRun('running')), 'running')
})

test('a stopped run needs attention, with Results still the active stage', () => {
	assert.deepEqual(states(withRun('stopped')), ['done', 'done', 'done', 'done', 'active'])
	assert.equal(evaluationStatus(withRun('stopped')), 'needsAttention')
})

test('a completed run finishes every stage', () => {
	assert.deepEqual(states(withRun('completed')), ['done', 'done', 'done', 'done', 'done'])
	assert.equal(evaluationStatus(withRun('completed')), 'complete')
	assert.equal(activeStage(stageStates(withRun('completed'))), null)
})

test('Results point at the latest run once there is one, under any base', () => {
	assert.equal(stageHref('/evaluations/e1', 'records', null), '/evaluations/e1/records')
	assert.equal(stageHref('/evaluations/e1', 'results', null), '/evaluations/e1/results')
	assert.equal(stageHref('/evaluations/e1', 'results', 'r1'), '/evaluations/e1/runs/r1/results')
	assert.equal(stageHref('/sandbox', 'plan', 'r1'), '/sandbox/plan')
	assert.equal(stageHref('/sandbox', 'results', 'r1'), '/sandbox/runs/r1/results')
})

test('opening an evaluation lands on results once a run exists, else where the work is', () => {
	const land = (input: StageInput) => landingStage(stageStates(input))
	assert.equal(land(fresh), 'records')
	assert.equal(land({ ...fresh, hasRecords: true }), 'vendors')
	assert.equal(land({ ...fresh, hasRecords: true, hasVendors: true }), 'plan')
	assert.equal(land(withRun('running')), 'results')
	assert.equal(land(withRun('stopped')), 'results')
	assert.equal(land(withRun('completed')), 'results')
})

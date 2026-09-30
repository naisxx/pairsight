import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	buildJevRequest,
	classifyFailure,
	DEFAULT_IDENTITY,
	judgmentKey,
	parseJevAnswer,
	type JudgmentConfig
} from './judgment'

const config: JudgmentConfig = {
	identity: DEFAULT_IDENTITY,
	jevFields: ['first_name', 'last_name', 'email'],
	country: 'us',
	model: 'jev-latest'
}

test('the Jev request carries only the selected identity fields — no references or vendor data', () => {
	const request = buildJevRequest({
		recordA: { first_name: 'Jane', last_name: 'Smith', email: '', phone: '555' },
		recordB: { first_name: 'Jane', last_name: 'Smyth', email: 'jane@x.com' },
		config
	})
	assert.deepEqual(request.state, {
		record_1: { first_name: 'Jane', last_name: 'Smith' },
		record_2: { first_name: 'Jane', last_name: 'Smyth', email: 'jane@x.com' },
		country: 'US'
	})
	const question = request.questions.same_individual
	assert.equal(question.type, 'noul')
	assert.deepEqual(question.criteria, {
		true: DEFAULT_IDENTITY.same,
		false: DEFAULT_IDENTITY.different
	})
})

test('parseJevAnswer accepts only a documented noul in [0, 1]', () => {
	assert.deepEqual(
		parseJevAnswer({
			model: 'jev-1.13-20260917',
			answers: { same_individual: { type: 'noul', noul: 0.82 } }
		}),
		{ ok: true, score: 0.82, modelReported: 'jev-1.13-20260917' }
	)
	for (const body of [
		{},
		{ answers: { same_individual: { type: 'noul' } } },
		{ answers: { same_individual: { type: 'noul', noul: 1.4 } } },
		{ answers: { same_individual: { type: 'choice', choice: 'yes' } } },
		null
	]) {
		assert.deepEqual(parseJevAnswer(body), { ok: false, code: 'invalid_response' })
	}
})

test('the judgment key ignores field order and changes with every judgment input', () => {
	const base = judgmentKey(config)
	assert.equal(judgmentKey({ ...config, jevFields: ['email', 'last_name', 'first_name'] }), base)
	assert.notEqual(judgmentKey({ ...config, country: 'GB' }), base)
	assert.notEqual(judgmentKey({ ...config, identity: { ...config.identity, same: 'x' } }), base)
	assert.notEqual(judgmentKey({ ...config, model: 'jev-1.13.0' }), base)
})

test('failures: 429/529/5xx and timeouts retry, 422 fails, config stops the run', () => {
	assert.equal(classifyFailure({ kind: 'http', status: 429 }), 'retry')
	assert.equal(classifyFailure({ kind: 'http', status: 529 }), 'retry')
	assert.equal(classifyFailure({ kind: 'timeout' }), 'retry')
	assert.equal(classifyFailure({ kind: 'network' }), 'retry')
	assert.equal(classifyFailure({ kind: 'http', status: 422 }), 'fail')
	assert.equal(classifyFailure({ kind: 'config', status: 401 }), 'stop_run')
})

import { createHash } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	buildJevRequest,
	classifyFailure,
	DEFAULT_IDENTITY,
	defaultIdentity,
	judgmentKey,
	parseJevAnswer,
	type JudgmentConfig
} from './judgment'

const config: JudgmentConfig = {
	entityType: 'person',
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
		parseJevAnswer(
			{
				model: 'jev-1.13-20260917',
				answers: { same_individual: { type: 'noul', noul: 0.82 } }
			},
			'person'
		),
		{ ok: true, score: 0.82, modelReported: 'jev-1.13-20260917' }
	)
	// Each type reads the answer to its own question.
	assert.deepEqual(
		parseJevAnswer({ answers: { same_product: { type: 'noul', noul: 0.3 } } }, 'product'),
		{ ok: true, score: 0.3, modelReported: null }
	)
	assert.deepEqual(
		parseJevAnswer({ answers: { same_individual: { type: 'noul', noul: 0.3 } } }, 'product'),
		{ ok: false, code: 'invalid_response' }
	)
	for (const body of [
		{},
		{ answers: { same_individual: { type: 'noul' } } },
		{ answers: { same_individual: { type: 'noul', noul: 1.4 } } },
		{ answers: { same_individual: { type: 'choice', choice: 'yes' } } },
		null
	]) {
		assert.deepEqual(parseJevAnswer(body, 'person'), { ok: false, code: 'invalid_response' })
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

test('a person is asked exactly what people were always asked, under the same key', () => {
	// The key as it was before entity types: earlier person judgments stay reusable.
	const before = createHash('sha256')
		.update(
			JSON.stringify({
				version: 1,
				identity: config.identity,
				jevFields: [...config.jevFields].sort(),
				country: 'US',
				model: config.model
			})
		)
		.digest('hex')
	assert.equal(judgmentKey(config), before)
	const request = buildJevRequest({ recordA: {}, recordB: {}, config })
	assert.equal(
		request.questions.same_individual?.instructions,
		'Do record_1 and record_2 describe the same individual person?'
	)
})

test('organisations and products get their own question, definition and key', () => {
	const company: JudgmentConfig = {
		...config,
		entityType: 'company',
		identity: defaultIdentity('company'),
		jevFields: ['company_name', 'website']
	}
	const request = buildJevRequest({
		recordA: { company_name: 'Acme Ltd', website: 'acme.test' },
		recordB: { company_name: 'ACME Limited', website: 'www.acme.test' },
		config: company
	})
	const question = request.questions.same_organisation
	assert.match(question?.instructions ?? '', /same organisation/)
	assert.deepEqual(question?.criteria, {
		true: defaultIdentity('company').same,
		false: defaultIdentity('company').different
	})
	assert.deepEqual(request.state.record_1, { company_name: 'Acme Ltd', website: 'acme.test' })
	// Same inputs as another type: never the same key.
	assert.notEqual(judgmentKey({ ...company, entityType: 'product' }), judgmentKey(company))
})

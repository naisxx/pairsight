import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BUNDLED_RATE_CARD } from './bundled-rates'
import { OPENROUTER_SLUGS, openRouterSlug, type TrackedModel } from './models'
import { costMicroUsd } from './pricing'

// On-prem prices every call from the bundled card (sink.ts), so a model it
// lacks is recorded unpriced on every install until the next release.

test('the bundled card prices every mapped model', () => {
	const models = Object.keys(OPENROUTER_SLUGS) as TrackedModel[]
	const missing = models.filter((model) => !BUNDLED_RATE_CARD.has(openRouterSlug(model) ?? ''))
	assert.deepEqual(missing, [])
})

test('a Jev call priced from the bundled card costs something, not null or zero', () => {
	// The Settings key check's size: one made-up pair in, one answer out.
	const tokens = { inputTokens: 160, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }
	const cost = costMicroUsd(tokens, BUNDLED_RATE_CARD.get(openRouterSlug('jev-1.13.0') ?? ''))
	assert.ok(cost != null && cost > 0, `expected a positive cost, got ${cost}`)
})

#!/usr/bin/env node
// Checks this project's model map against OpenRouter's live catalogue.
//
// This is the direction TypeScript cannot catch. `TrackedModel` in
// src/server/lib/ai-usage/models.ts already makes an unmapped model a
// typecheck failure at the call site; what it cannot see is a slug that was
// correct when it was written and has since been retired upstream. That is
// how a mapping rots with nobody touching the code, and how a model silently
// starts costing $0 in the reports.
//
// Usage: node --import ./scripts/register-ts.mjs scripts/check-ai-models.mjs
//
// Exit codes: 0 clean (or upstream unreachable), 1 a mapped slug is gone.

import { readFileSync } from 'node:fs'
import { fetchRateCard } from '../src/server/lib/ai-usage/pricing.ts'
import { OPENROUTER_SLUGS } from '../src/server/lib/ai-usage/models.ts'

// The rate card on-prem installs price with instead (pnpm ai:rate-card).
const BUNDLED_RATE_CARD = 'src/server/lib/ai-usage/rate-card.json'

const mapped = Object.entries(OPENROUTER_SLUGS)

if (mapped.length === 0) {
	console.log('No models mapped — nothing to check. (A project with no AI calls is fine here.)')
	process.exit(0)
}

// Offline, so checked first: an on-prem install prices a model only if the
// bundled card has it, and an unpriced call is NULL there for good.
const bundled = JSON.parse(readFileSync(BUNDLED_RATE_CARD, 'utf8')).rates
const unbundled = mapped.filter(([, slug]) => bundled[slug] == null)
if (unbundled.length > 0) {
	console.error(
		`${BUNDLED_RATE_CARD} has no rates for: ${unbundled.map(([model]) => model).join(', ')}. ` +
			`Run pnpm ai:rate-card and commit the file.`
	)
	process.exit(1)
}

let rates
try {
	rates = await fetchRateCard()
} catch (error) {
	// Deliberately not a failure. A network blip upstream must not turn every
	// PR in every repo red, and the runtime path already degrades correctly:
	// no rate card means rows are written unpriced and reported in the
	// `unpriced` array, not lost and not zeroed.
	console.warn(`Could not reach OpenRouter, skipping the check: ${error.message}`)
	process.exit(0)
}

const retired = mapped.filter(([, slug]) => !rates.has(slug))

if (retired.length > 0) {
	console.error(
		`OpenRouter no longer lists ${retired.length} mapped slug(s). Until they are ` +
			`updated in src/server/lib/ai-usage/models.ts, every call to these models ` +
			`is recorded unpriced:\n`
	)
	for (const [model, slug] of retired) {
		console.error(`  ${model}  ->  ${slug}`)
	}
	console.error(
		`\nFind the current slug at https://openrouter.ai/api/v1/models — note that ` +
			`the id and the canonical_slug differ, and it is the "id" field that belongs here.`
	)
	process.exit(1)
}

console.log(`All ${mapped.length} mapped model(s) still priced by OpenRouter.`)

// Batch tiers are separate upstream entries, so a model can be mapped
// correctly and still have no batch price. Worth saying out loud rather than
// failing on, since most projects never call the batch tier.
const withoutBatch = mapped
	.filter(([, slug]) => !rates.has(`${slug}:batch`))
	.map(([model]) => model)
if (withoutBatch.length > 0) {
	console.log(`No batch tier upstream for: ${withoutBatch.join(', ')} (fine unless you use it).`)
}

// Rates move every few weeks; on-prem keeps the day it shipped with. Worth
// refreshing before a release, not worth failing a PR over.
const moved = mapped
	.filter(([, slug]) => JSON.stringify(bundled[slug]) !== JSON.stringify(rates.get(slug)))
	.map(([model]) => model)
if (moved.length > 0) {
	console.log(
		`The bundled rate card is behind OpenRouter for: ${moved.join(', ')}. ` +
			`Run pnpm ai:rate-card before the next on-prem release.`
	)
}

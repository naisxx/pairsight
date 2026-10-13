#!/usr/bin/env node
// Writes the rate card an on-prem install prices its AI calls with
// (src/server/lib/ai-usage/rate-card.json): OpenRouter's rates for every
// slug this project maps, standard and batch, taken from the live catalogue.
// On-prem never fetches the catalogue (docs/PairSight-OnPrem.md), so this
// file is how its calls still get priced at write time. `pnpm check:ai-models`
// fails when it's missing a mapped slug and warns when a rate has moved.
//
// Usage: pnpm ai:rate-card

import { writeFileSync } from 'node:fs'
import { fetchRateCard } from '../src/server/lib/ai-usage/pricing.ts'
import { OPENROUTER_SLUGS } from '../src/server/lib/ai-usage/models.ts'

const OUT = 'src/server/lib/ai-usage/rate-card.json'

const live = await fetchRateCard()
const slugs = [...new Set(Object.values(OPENROUTER_SLUGS))].flatMap((slug) => [
	slug,
	`${slug}:batch`
])
const rates = Object.fromEntries(
	slugs.filter((slug) => live.has(slug)).map((slug) => [slug, live.get(slug)])
)
const missing = Object.values(OPENROUTER_SLUGS).filter((slug) => !(slug in rates))
if (missing.length > 0) {
	console.error(`OpenRouter doesn't list: ${[...new Set(missing)].join(', ')}`)
	process.exit(1)
}
writeFileSync(
	OUT,
	`${JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), rates }, null, '\t')}\n`
)
console.log(`${OUT}: ${Object.keys(rates).length} rates`)

// How much fuzzy blocking adds, on a file with planted duplicates
// (scripts/blocking-check/): pair completeness, pair count and reduction
// ratio for the default people rules, then with the fuzzy presets added.
// No Jev and no database.
//
// Usage: pnpm blocking:check

import { defaultRules, presetsFor } from '../src/lib/pairsight/entity-types.ts'
import { isFuzzyRule } from '../src/lib/pairsight/derived-keys.ts'
import { blockingQuality } from '../src/server/pairsight/blocking-quality.ts'
import { CHECK_COUNTRY, loadBlockingCheck } from './blocking-check/load.mts'

const PERCENT = 100
const { records, duplicates } = await loadBlockingCheck()
const exact = defaultRules('person')
const fuzzy = presetsFor('person')
	.filter(isFuzzyRule)
	.map((preset) => ({ id: preset.id, fields: [...preset.fields] }))

const percent = (share: number) => `${(share * PERCENT).toFixed(1)}%`
console.log(`${records.length} records, ${duplicates.length} planted duplicates\n`)
for (const [label, rules] of [
	['Default rules', exact],
	['Default + fuzzy presets', [...exact, ...fuzzy]]
] as const) {
	const quality = blockingQuality({ records, rules, duplicates, country: CHECK_COUNTRY })
	console.log(label)
	console.log(`  rules            ${rules.map((rule) => rule.id).join(', ')}`)
	console.log(
		`  completeness     ${quality.found}/${quality.known} (${percent(quality.completeness)})`
	)
	console.log(`  candidate pairs  ${quality.pairCount}`)
	console.log(`  reduction ratio  ${percent(quality.reductionRatio)}`)
	for (const miss of quality.missed) {
		console.log(`  missed           ${miss.recordA}–${miss.recordB} (${miss.kind})`)
	}
	console.log('')
}

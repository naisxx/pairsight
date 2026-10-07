// Benchmark for the Splink service (roadmap items 5 and 10): writes one
// dataset of fictional records exactly as the app hands it to Splink
// (src/server/pairsight/splink/records.ts), plus its answer key and how
// today's rules do on it. No database, no Jev.
//
// Usage: node … scripts/splink-spike/export.mts <person|company|product> <2k|10k|100k>
//        node … scripts/splink-spike/export.mts person hard
// Writes scripts/splink-spike/out/<type>-<size>/{records.csv,truth.csv,
// traps.csv,rules.json,meta.json}.

import { mkdir, writeFile } from 'node:fs/promises'
import {
	defaultRules,
	ENTITY_TYPES,
	presetsFor,
	type EntityType
} from '../../src/lib/pairsight/entity-types.ts'
import { isFuzzyRule } from '../../src/lib/pairsight/derived-keys.ts'
import {
	blockingQuality,
	type KnownDuplicate
} from '../../src/server/pairsight/blocking-quality.ts'
import type { BlockingRecord } from '../../src/server/pairsight/blocking.ts'
import { splinkRecordLines } from '../../src/server/pairsight/splink/records.ts'
import { canonicalPair } from '../../src/server/pairsight/pairs.ts'
import { CHECK_COUNTRY, loadBlockingCheck } from '../blocking-check/load.mts'
import { companyRecords, generateCompanies } from '../scale/companies.mts'
import { generatePeople, toRecords } from '../scale/people.mts'
import { generateProducts, productRecords } from '../scale/products.mts'

// The generated files: the same seed item 0 measured at 10K.
const SEED = 42
const SIZES = { '2k': 2_000, '10k': 10_000, '100k': 100_000 } as const
type Size = keyof typeof SIZES

const [typeArg, sizeArg] = process.argv.slice(2)
const isType = (value: string | undefined): value is EntityType =>
	ENTITY_TYPES.some((type) => type === value)
const isSize = (value: string | undefined): value is Size =>
	value != null && Object.hasOwn(SIZES, value)
if (!isType(typeArg) || !(isSize(sizeArg) || (typeArg === 'person' && sizeArg === 'hard'))) {
	throw new Error('Usage: export.mts <person|company|product> <2k|10k|100k>, or person hard')
}
const type = typeArg

function generated(): {
	records: BlockingRecord[]
	duplicates: KnownDuplicate[]
	traps: KnownDuplicate[]
} {
	if (!isSize(sizeArg)) return { traps: [], ...loadBlockingCheckSync() }
	const size = SIZES[sizeArg]
	switch (type) {
		case 'person': {
			const people = generatePeople(size, SEED)
			return { records: toRecords(people.rows), duplicates: people.duplicates, traps: [] }
		}
		case 'company': {
			const companies = generateCompanies(size, SEED)
			return {
				records: companyRecords(companies.rows),
				duplicates: companies.duplicates,
				traps: []
			}
		}
		case 'product': {
			const products = generateProducts(size, SEED)
			return {
				records: productRecords(products.rows),
				duplicates: products.duplicates,
				traps: products.traps
			}
		}
	}
}
const hard = sizeArg === 'hard' ? await loadBlockingCheck() : null
function loadBlockingCheckSync() {
	if (hard == null) throw new Error('the hard set is people only')
	return hard
}
const { records, duplicates, traps } = generated()

const cell = (value: string | null) =>
	value == null ? '' : /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

function pairsCsv(known: KnownDuplicate[]): string {
	const lines = known.flatMap((duplicate) => {
		const pair = canonicalPair(duplicate.recordA, duplicate.recordB)
		return pair == null ? [] : [[pair.a, pair.b, cell(duplicate.kind)].join(',')]
	})
	return ['a,b,kind', ...lines].join('\n') + '\n'
}

// Today's rules on the same records, scored the same way score.py scores
// Splink: duplicates found, by kind, and pairs to check.
function rulesReport() {
	const ruleSets = {
		'Default rules': defaultRules(type),
		'Default + close-match presets': [
			...defaultRules(type),
			...presetsFor(type)
				.filter(isFuzzyRule)
				.map((rule) => ({ id: rule.id, fields: [...rule.fields] }))
		]
	}
	return Object.entries(ruleSets).map(([label, rules]) => {
		const started = performance.now()
		const quality = blockingQuality({ records, rules, duplicates, country: CHECK_COUNTRY })
		const missedByKind: Record<string, number> = {}
		for (const missed of quality.missed) {
			missedByKind[missed.kind] = (missedByKind[missed.kind] ?? 0) + 1
		}
		// The variant traps the rules bring up too, for products.
		const trapsPicked = blockingQuality({
			records,
			rules,
			duplicates: traps,
			country: CHECK_COUNTRY
		}).found
		return {
			label,
			rules: rules.map((rule) => rule.id),
			pairs: quality.pairCount,
			found: quality.found,
			known: quality.known,
			trapsPicked,
			missedByKind,
			seconds: Number(((performance.now() - started) / 1000).toFixed(2))
		}
	})
}

const name = `${type}-${sizeArg}`
const out = new URL(`./out/${name}/`, import.meta.url)
await mkdir(out, { recursive: true })
await writeFile(
	new URL('records.csv', out),
	[...splinkRecordLines(records, { type, country: CHECK_COUNTRY })].join('')
)
await writeFile(new URL('truth.csv', out), pairsCsv(duplicates))
await writeFile(new URL('traps.csv', out), pairsCsv(traps))
await writeFile(new URL('meta.json', out), JSON.stringify({ type, size: sizeArg }, null, 2))
const report = rulesReport()
await writeFile(new URL('rules.json', out), JSON.stringify(report, null, 2))
console.log(
	`${name}: ${records.length} records, ${duplicates.length} known duplicates, ${traps.length} variant traps`
)
for (const line of report) {
	console.log(
		`  ${line.label}: ${line.found}/${line.known} found, ${line.pairs} pairs, ${line.trapsPicked} traps, ${line.seconds} s`
	)
}

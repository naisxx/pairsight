// Benchmark for the Splink service (roadmap items 5 and 10): writes one
// dataset of fictional records exactly as the app hands it to Splink
// (src/server/pairsight/splink/records.ts), plus its answer key. No
// database, no Jev. The comparison with the old comparison rules is in the
// roadmap (items 5 and 10); the rules themselves are gone.
//
// Usage: node … scripts/splink-spike/export.mts <person|company|product> <2k|10k|100k>
// Writes scripts/splink-spike/out/<type>-<size>/{records.csv,truth.csv,
// traps.csv,meta.json}.

import { mkdir, writeFile } from 'node:fs/promises'
import { ENTITY_TYPES, type EntityType } from '../../src/lib/pairsight/entity-types.ts'
import type { ScoringRecord } from '../../src/server/pairsight/scoring-records.ts'
import { splinkRecordLines } from '../../src/server/pairsight/splink/records.ts'
import { canonicalPair } from '../../src/server/pairsight/pairs.ts'
import { companyRecords, generateCompanies } from '../scale/companies.mts'
import { generatePeople, toRecords, type KnownDuplicate } from '../scale/people.mts'
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
if (!isType(typeArg) || !isSize(sizeArg)) {
	throw new Error('Usage: export.mts <person|company|product> <2k|10k|100k>')
}
const type = typeArg
const size = SIZES[sizeArg]
// The country the generated records are from: UK postcodes and phones.
const COUNTRY = 'GB'

function generated(): {
	records: ScoringRecord[]
	duplicates: KnownDuplicate[]
	traps: KnownDuplicate[]
} {
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

const name = `${type}-${sizeArg}`
const out = new URL(`./out/${name}/`, import.meta.url)
await mkdir(out, { recursive: true })
await writeFile(
	new URL('records.csv', out),
	[...splinkRecordLines(records, { type, country: COUNTRY })].join('')
)
await writeFile(new URL('truth.csv', out), pairsCsv(duplicates))
await writeFile(new URL('traps.csv', out), pairsCsv(traps))
await writeFile(new URL('meta.json', out), JSON.stringify({ type, size: sizeArg }, null, 2))
console.log(
	`${name}: ${records.length} records, ${duplicates.length} known duplicates, ${traps.length} variant traps`
)

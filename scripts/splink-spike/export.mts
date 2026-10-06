// Benchmark for the Splink service (roadmap item 5): writes one dataset of
// fictional people exactly as the app hands it to Splink
// (src/server/pairsight/splink/records.ts), plus its answer key and how today's
// rules do on it. No database, no Jev.
//
// Usage: node … scripts/splink-spike/export.mts <hard | 10k | 100k>
// Writes scripts/splink-spike/out/<name>/{records.csv,truth.csv,rules.json}.

import { mkdir, writeFile } from 'node:fs/promises'
import { defaultRules, presetsFor } from '../../src/lib/pairsight/entity-types.ts'
import { isFuzzyRule } from '../../src/lib/pairsight/derived-keys.ts'
import {
	blockingQuality,
	type KnownDuplicate
} from '../../src/server/pairsight/blocking-quality.ts'
import { splinkRecordLines } from '../../src/server/pairsight/splink/records.ts'
import { canonicalPair } from '../../src/server/pairsight/pairs.ts'
import { CHECK_COUNTRY, loadBlockingCheck } from '../blocking-check/load.mts'
import { generatePeople, toRecords } from '../scale/people.mts'

// The generated files: the same seed item 0 measured at 10K.
const SEED = 42
const SIZES = { '10k': 10_000, '100k': 100_000 } as const

const name = process.argv[2]
if (name !== 'hard' && name !== '10k' && name !== '100k') {
	throw new Error('Usage: export.mts <hard | 10k | 100k>')
}

const { records, duplicates } =
	name === 'hard'
		? await loadBlockingCheck()
		: (() => {
				const people = generatePeople(SIZES[name], SEED)
				return { records: toRecords(people.rows), duplicates: people.duplicates }
			})()

const cell = (value: string | null) =>
	value == null ? '' : /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

function truthCsv(known: KnownDuplicate[]): string {
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
		'Default rules': defaultRules('person'),
		'Default + close-match presets': [
			...defaultRules('person'),
			...presetsFor('person')
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
		return {
			label,
			rules: rules.map((rule) => rule.id),
			pairs: quality.pairCount,
			found: quality.found,
			known: quality.known,
			missedByKind,
			seconds: Number(((performance.now() - started) / 1000).toFixed(2))
		}
	})
}

const out = new URL(`./out/${name}/`, import.meta.url)
await mkdir(out, { recursive: true })
await writeFile(
	new URL('records.csv', out),
	[...splinkRecordLines(records, CHECK_COUNTRY)].join('')
)
await writeFile(new URL('truth.csv', out), truthCsv(duplicates))
const report = rulesReport()
await writeFile(new URL('rules.json', out), JSON.stringify(report, null, 2))
console.log(`${name}: ${records.length} records, ${duplicates.length} known duplicates`)
for (const line of report) {
	console.log(
		`  ${line.label}: ${line.found}/${line.known} found, ${line.pairs} pairs, ${line.seconds} s`
	)
}

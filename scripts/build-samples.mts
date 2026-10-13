// Writes the sample files Records and Vendors offer for download
// (public/samples/): the demo's 2,000 made-up organisations, and two vendor
// files for them, one a list of pairs and one a list of groups, so a new
// user can see each shape and even run a whole evaluation with them. Built
// from the demo's recorded snapshot, so they always match the demo.
//
// pnpm samples:build
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SNAPSHOT = 'prisma/demo/sandbox-companies-snapshot.json'
const OUT = 'public/samples'
// The order a records export would list them in: the ID, then who, then how
// to reach them.
const COLUMNS = [
	'record_id',
	'company_name',
	'trading_name',
	'registration_number',
	'tax_id',
	'website',
	'email',
	'phone',
	'address',
	'city',
	'postcode',
	'industry'
]

type Snapshot = {
	dataset: { records: Array<{ values: Record<string, string> }> }
	vendors: Array<{ format: 'pair' | 'group'; matches: Array<[string, string]> }>
}

function cell(value: string): string {
	return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function csv(rows: string[][]): string {
	return `${rows.map((row) => row.map(cell).join(',')).join('\n')}\n`
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot
const pairs = snapshot.vendors.find((vendor) => vendor.format === 'pair')
const groups = snapshot.vendors.find((vendor) => vendor.format === 'group')
if (pairs == null || groups == null) throw new Error(`${SNAPSHOT} needs a pair and a group vendor`)

mkdirSync(OUT, { recursive: true })
const files: Array<[string, string[][]]> = [
	[
		'pairsight-sample-records.csv',
		[COLUMNS, ...snapshot.dataset.records.map(({ values }) => COLUMNS.map((c) => values[c] ?? ''))]
	],
	['pairsight-sample-vendor-pairs.csv', [['left_id', 'right_id'], ...pairs.matches]],
	[
		'pairsight-sample-vendor-groups.csv',
		[
			['match_id', 'record'],
			...groups.matches.flatMap(([a, b], index) => {
				const group = `G${String(index + 1).padStart(4, '0')}`
				return [
					[group, a],
					[group, b]
				]
			})
		]
	]
]
for (const [name, rows] of files) {
	writeFileSync(path.join(OUT, name), csv(rows))
	process.stdout.write(`${name}: ${rows.length - 1} rows\n`)
}

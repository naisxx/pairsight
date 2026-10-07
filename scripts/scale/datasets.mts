// Ready-to-upload test sets: fictional people, organisations and products
// with planted duplicates, plus two vendor files each (every pair a vendor
// matched is always checked, so the vendor files set how many pairs Jev
// gets on top of PairSight's suggestions). Seeded, so the same command writes
// the same files. Made up entirely.
//
// Usage: pnpm scale:datasets "<folder>"
//
// Sized to today's limits: up to 10,000 records (docs/PairSight-Scale-Roadmap.md,
// item 3). The organisation and product sets are sized for PairSight's
// suggestions (item 10): 2,500 records, the size most real files are, and
// 10,000, the most a file can hold. Each 10K set also comes as an Excel
// workbook, to try a big workbook upload.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { COMPANY_HEADERS, companiesCsv, generateCompanies } from './companies.mts'
import { generatePeople, HEADERS, toCsv, type KnownDuplicate } from './people.mts'
import { generateProducts, PRODUCT_HEADERS, productsCsv } from './products.mts'

type Generated = {
	headers: readonly string[]
	rows: Array<Record<string, string>>
	csv: string
	duplicates: KnownDuplicate[]
	// Pairs that look alike but aren't the same: what an over-eager vendor
	// merges (firms sharing a name, a product's other sizes and colours).
	lookalikes: Array<readonly [string, string]>
}

type Set = {
	type: 'people' | 'organisations' | 'products'
	name: string
	records: number
	// Wrong matches each vendor makes, besides the duplicates it finds.
	aggressiveExtra: number
	carefulExtra: number
	seed: number
	excel: boolean
}

// The careful vendor makes few wrong matches; the aggressive one over-merges,
// which is what makes a run long.
const SETS: readonly Set[] = [
	{
		type: 'people',
		name: 'medium',
		records: 500,
		aggressiveExtra: 1_200,
		carefulExtra: 12,
		seed: 11,
		excel: false
	},
	{
		type: 'people',
		name: 'large',
		records: 500,
		aggressiveExtra: 4_400,
		carefulExtra: 25,
		seed: 12,
		excel: false
	},
	{
		type: 'people',
		name: '10k',
		records: 10_000,
		aggressiveExtra: 2_000,
		carefulExtra: 40,
		seed: 13,
		excel: true
	},
	{
		type: 'organisations',
		name: '2500',
		records: 2_500,
		aggressiveExtra: 600,
		carefulExtra: 15,
		seed: 21,
		excel: false
	},
	{
		type: 'organisations',
		name: '10k',
		records: 10_000,
		aggressiveExtra: 2_000,
		carefulExtra: 40,
		seed: 22,
		excel: true
	},
	{
		type: 'products',
		name: '2500',
		records: 2_500,
		aggressiveExtra: 600,
		carefulExtra: 15,
		seed: 31,
		excel: false
	},
	{
		type: 'products',
		name: '10k',
		records: 10_000,
		aggressiveExtra: 2_000,
		carefulExtra: 40,
		seed: 32,
		excel: true
	}
]
const AGGRESSIVE_FINDS = 0.95
const CAREFUL_FINDS = 0.7
// Of the aggressive vendor's wrong matches, the share that are look-alikes
// rather than random pairs.
const LOOKALIKE_SHARE = 0.6

function random(seed: number): () => number {
	let state = seed
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
		return state / 2_147_483_648
	}
}

// Every pair inside each group of records sharing a key.
function pairsWithin(groups: Iterable<string[]>): Array<readonly [string, string]> {
	const pairs: Array<readonly [string, string]> = []
	for (const ids of groups) {
		for (const [index, first] of ids.entries()) {
			for (const second of ids.slice(index + 1)) pairs.push([first, second])
		}
	}
	return pairs
}

function generate(set: Set): Generated {
	switch (set.type) {
		case 'people': {
			const { rows, duplicates } = generatePeople(set.records, set.seed)
			return { headers: HEADERS, rows, csv: toCsv(rows), duplicates, lookalikes: [] }
		}
		case 'organisations': {
			const { rows, duplicates } = generateCompanies(set.records, set.seed)
			const planted = new Set(duplicates.map((pair) => `${pair.recordA}|${pair.recordB}`))
			// Firms whose names match once the legal suffix is gone.
			const byName = new Map<string, string[]>()
			for (const row of rows) {
				const name = row.company_name.toLowerCase().replace(/ (ltd|limited|plc|llp)\.?$/, '')
				byName.set(name, [...(byName.get(name) ?? []), row.record_id])
			}
			const lookalikes = pairsWithin(byName.values()).filter(
				([a, b]) => !planted.has(`${a}|${b}`) && !planted.has(`${b}|${a}`)
			)
			return { headers: COMPANY_HEADERS, rows, csv: companiesCsv(rows), duplicates, lookalikes }
		}
		case 'products': {
			const { rows, duplicates, traps } = generateProducts(set.records, set.seed)
			return {
				headers: PRODUCT_HEADERS,
				rows,
				csv: productsCsv(rows),
				duplicates,
				lookalikes: traps.map((trap) => [trap.recordA, trap.recordB] as const)
			}
		}
	}
}

const folder = process.argv[2]
if (folder == null || folder === '') {
	console.error('Usage: pnpm scale:datasets "<folder>"')
	process.exit(1)
}
await mkdir(folder, { recursive: true })

for (const set of SETS) {
	const { headers, rows, csv, duplicates, lookalikes } = generate(set)
	const next = random(set.seed)
	const ids = rows.map((row) => row.record_id ?? '')
	const randomPair = () => {
		const a = ids[Math.floor(next() * ids.length)] ?? ''
		let b = a
		while (b === a) b = ids[Math.floor(next() * ids.length)] ?? ''
		return [a, b] as const
	}
	const vendorFile = (finds: number, extra: number, lookalikeShare: number) => {
		const lines = ['left_id,right_id,match_score']
		for (const duplicate of duplicates) {
			if (next() < finds)
				lines.push(`${duplicate.recordA},${duplicate.recordB},0.9${Math.floor(next() * 9)}`)
		}
		const fromLookalikes = Math.min(lookalikes.length, Math.round(extra * lookalikeShare))
		for (let i = 0; i < fromLookalikes; i++) {
			const [a, b] = lookalikes[Math.floor(next() * lookalikes.length)] ?? randomPair()
			lines.push(`${a},${b},0.${70 + Math.floor(next() * 20)}`)
		}
		for (let i = fromLookalikes; i < extra; i++) {
			const [a, b] = randomPair()
			lines.push(`${a},${b},0.${50 + Math.floor(next() * 40)}`)
		}
		return { csv: lines.join('\n'), pairs: lines.length - 1 }
	}
	const aggressive = vendorFile(AGGRESSIVE_FINDS, set.aggressiveExtra, LOOKALIKE_SHARE)
	const careful = vendorFile(CAREFUL_FINDS, set.carefulExtra, 0)
	const prefix = path.join(folder, `${set.type}-${set.name}`)
	await writeFile(`${prefix}-records.csv`, csv)
	if (set.excel) {
		const book = new ExcelJS.Workbook()
		book
			.addWorksheet('Records')
			.addRows([[...headers], ...rows.map((row) => headers.map((header) => row[header] ?? ''))])
		await writeFile(`${prefix}-records.xlsx`, Buffer.from(await book.xlsx.writeBuffer()))
	}
	await writeFile(`${prefix}-vendor-aggressive.csv`, aggressive.csv)
	await writeFile(`${prefix}-vendor-careful.csv`, careful.csv)
	console.log(
		`${set.type}-${set.name}: ${rows.length} records · ${duplicates.length} planted duplicates · vendor files of ${aggressive.pairs} and ${careful.pairs} pairs`
	)
}

// Ready-to-upload test sets for watching a run work: fictional people plus
// vendor files sized to fill a run (every pair a vendor matched is always
// checked, so the vendor files set how many pairs Jev gets). Seeded, so the
// same command writes the same files. Made up entirely.
//
// Usage: pnpm scale:datasets "<folder>"
//
// Sized to today's limits: up to 10,000 records (docs/PairSight-Scale-Roadmap.md,
// item 3) and 5,000 pairs per run. The 10K set also comes as an Excel
// workbook, to try a big workbook upload.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { generatePeople, HEADERS, toCsv } from './people.mts'

// Share of planted duplicates each vendor finds, and how many random
// non-duplicate pairs it wrongly matches, per set.
// The careful vendor makes few wrong matches; the aggressive one over-merges,
// which is what makes a run long (500 records hold only so many duplicates).
const SETS = [
	{
		name: 'medium',
		records: 500,
		aggressiveExtra: 1_200,
		carefulExtra: 12,
		seed: 11,
		excel: false
	},
	{ name: 'large', records: 500, aggressiveExtra: 4_400, carefulExtra: 25, seed: 12, excel: false },
	// The default rules find about 1,200 pairs in 10K people; the vendors
	// keep a run under 5,000 pairs.
	{ name: '10k', records: 10_000, aggressiveExtra: 2_000, carefulExtra: 40, seed: 13, excel: true }
] as const
const AGGRESSIVE_FINDS = 0.95
const CAREFUL_FINDS = 0.7

function random(seed: number): () => number {
	let state = seed
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
		return state / 2_147_483_648
	}
}

const folder = process.argv[2]
if (folder == null || folder === '') {
	console.error('Usage: pnpm scale:datasets "<folder>"')
	process.exit(1)
}
await mkdir(folder, { recursive: true })

for (const set of SETS) {
	const { rows, duplicates } = generatePeople(set.records, set.seed)
	const next = random(set.seed)
	const ids = rows.map((row) => row.record_id)
	const randomPair = () => {
		const a = ids[Math.floor(next() * ids.length)] ?? ''
		let b = a
		while (b === a) b = ids[Math.floor(next() * ids.length)] ?? ''
		return [a, b] as const
	}
	const vendorFile = (finds: number, extra: number) => {
		const lines = ['left_id,right_id,match_score']
		for (const duplicate of duplicates) {
			if (next() < finds)
				lines.push(`${duplicate.recordA},${duplicate.recordB},0.9${Math.floor(next() * 9)}`)
		}
		for (let i = 0; i < extra; i++) {
			const [a, b] = randomPair()
			lines.push(`${a},${b},0.${50 + Math.floor(next() * 40)}`)
		}
		return { csv: lines.join('\n'), pairs: lines.length - 1 }
	}
	const aggressive = vendorFile(AGGRESSIVE_FINDS, set.aggressiveExtra)
	const careful = vendorFile(CAREFUL_FINDS, set.carefulExtra)
	const prefix = path.join(folder, `people-${set.name}`)
	await writeFile(`${prefix}-records.csv`, toCsv(rows))
	if (set.excel) {
		const book = new ExcelJS.Workbook()
		book
			.addWorksheet('Records')
			.addRows([[...HEADERS], ...rows.map((row) => HEADERS.map((header) => row[header]))])
		await writeFile(`${prefix}-records.xlsx`, Buffer.from(await book.xlsx.writeBuffer()))
	}
	await writeFile(`${prefix}-vendor-aggressive.csv`, aggressive.csv)
	await writeFile(`${prefix}-vendor-careful.csv`, careful.csv)
	console.log(
		`people-${set.name}: ${rows.length} records · ${duplicates.length} planted duplicates · vendor files of ${aggressive.pairs} and ${careful.pairs} pairs`
	)
}

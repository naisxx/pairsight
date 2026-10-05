// Ready-to-upload test sets for watching a run work: fictional people plus
// vendor files sized to fill a run (every pair a vendor matched is always
// checked, so the vendor files set how many pairs Jev gets). Seeded, so the
// same command writes the same files. Made up entirely.
//
// Usage: pnpm scale:datasets "<folder>"
//
// Sized to today's limits (500 records, 5,000 pairs per run) until large
// uploads land (docs/PairSight-Scale-Roadmap.md, item 3).

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generatePeople, toCsv } from './people.mts'

const RECORDS = 500
// Share of planted duplicates each vendor finds, and how many random
// non-duplicate pairs it wrongly matches, per set.
// The careful vendor makes few wrong matches; the aggressive one over-merges,
// which is what makes a run long (500 records hold only so many duplicates).
const SETS = [
	{ name: 'medium', aggressiveExtra: 1_200, carefulExtra: 12, seed: 11 },
	{ name: 'large', aggressiveExtra: 4_400, carefulExtra: 25, seed: 12 }
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
	const { rows, duplicates } = generatePeople(RECORDS, set.seed)
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
	await writeFile(`${prefix}-vendor-aggressive.csv`, aggressive.csv)
	await writeFile(`${prefix}-vendor-careful.csv`, careful.csv)
	console.log(
		`people-${set.name}: ${rows.length} records · ${duplicates.length} planted duplicates · vendor files of ${aggressive.pairs} and ${careful.pairs} pairs`
	)
}

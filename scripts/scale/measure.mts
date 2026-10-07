// Pushes a synthetic file of fictional people (scale/people.mts) through
// today's code to see where it strains: the file size against the upload
// limits, and reading it. Which pairs get picked from it is measured by the
// suggestions benchmark (scripts/splink-spike/). No database and no Jev.
//
// Usage: pnpm scale:measure          (10,000 people)
//        pnpm scale:measure 50000

import { MAX_FILE_BYTES } from '../../src/lib/pairsight/tabular-formats.ts'
import { LIMITS } from '../../src/server/pairsight/limits.ts'
import { readTable } from '../../src/server/pairsight/tabular/index.ts'
import { generatePeople, toCsv } from './people.mts'

const DEFAULT_SIZE = 10_000
// The server-action body limit in next.config.ts.
const ACTION_BODY_BYTES = 2_000_000
const MB = 1_000_000

const size = Number(process.argv[2] ?? DEFAULT_SIZE)
const heapMb = () => (process.memoryUsage().heapUsed / MB).toFixed(0)
const timed = async <T,>(work: () => T | Promise<T>) => {
	const started = performance.now()
	const result = await work()
	return { result, ms: Math.round(performance.now() - started) }
}

const { rows, duplicates } = generatePeople(size)
const csv = new TextEncoder().encode(toCsv(rows))
const possible = (size * (size - 1)) / 2
console.log(
	`${size.toLocaleString()} fictional people · ${duplicates.length.toLocaleString()} planted duplicates · ${possible.toLocaleString()} possible pairs\n`
)

console.log('File')
console.log(
	`  size              ${(csv.length / MB).toFixed(2)} MB (upload limit ${MAX_FILE_BYTES / MB} MB, server-action limit ${ACTION_BODY_BYTES / MB} MB)`
)
console.log(
	`  record limit      ${LIMITS.maxSourceRecords.toLocaleString()}: ${size > LIMITS.maxSourceRecords ? 'over today’s limit' : 'within'}`
)
const read = await timed(() => readTable({ fileName: 'people.csv', bytes: csv, maxRows: size + 1 }))
console.log(
	`  reading           ${read.ms} ms · heap ${heapMb()} MB · ${read.result.ok ? `${read.result.table.rows.length.toLocaleString()} rows` : `failed: ${read.result.error.code}`}`
)

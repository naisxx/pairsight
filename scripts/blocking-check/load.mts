import { readFile } from 'node:fs/promises'
import { readTable } from '../../src/server/pairsight/tabular/index.ts'
import type { BlockingRecord } from '../../src/server/pairsight/blocking.ts'
import type { KnownDuplicate } from '../../src/server/pairsight/blocking-quality.ts'
import type { IdentityRole } from '../../src/lib/pairsight/entity-types.ts'
import { IDENTITY_ROLES } from '../../src/lib/pairsight/entity-types.ts'

// The planted-duplicate file and its answer key: fictional people whose
// column names are already field names, with the known duplicate pairs.
const DIR = new URL('./', import.meta.url)
const MAX_ROWS = 10_000
export const CHECK_COUNTRY = 'GB'

async function rowsOf(file: string): Promise<{ headers: string[]; rows: string[][] }> {
	const bytes = new Uint8Array(await readFile(new URL(file, DIR)))
	const result = await readTable({ fileName: file, bytes, maxRows: MAX_ROWS })
	if (!result.ok) throw new Error(`Couldn't read ${file}: ${result.error.code}`)
	return result.table
}

function isRole(header: string): header is IdentityRole {
	return IDENTITY_ROLES.some((role) => role === header)
}

export async function loadBlockingCheck(): Promise<{
	records: BlockingRecord[]
	duplicates: KnownDuplicate[]
}> {
	const people = await rowsOf('people-hard.csv')
	const records = people.rows.map((row) => {
		const fields: BlockingRecord['fields'] = {}
		people.headers.forEach((header, index) => {
			const value = row[index]
			if (isRole(header) && value != null && value !== '') fields[header] = value
		})
		return { id: row[0] ?? '', fields }
	})
	const truth = await rowsOf('people-hard-truth.csv')
	const duplicates = truth.rows.map(([recordA = '', recordB = '', kind = '']) => ({
		recordA,
		recordB,
		kind
	}))
	return { records, duplicates }
}

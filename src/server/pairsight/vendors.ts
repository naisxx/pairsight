import type { CsvTable } from './csv'
import { canonicalPair, pairKey, type CanonicalPair } from './pairs'

// The standard pair CSV: one positive match per row, two reference columns
// the user picks. Other columns (vendor scores, labels) are ignored and never
// reach Jev. An unknown reference is an error the user must fix; a self-pair
// or a repeated/reversed row is skipped and counted, not an error.

const FIRST_DATA_ROW = 2

export type VendorPairParse = {
	pairs: CanonicalPair[]
	unknownReferences: Array<{ row: number; reference: string }>
	missingReferenceRows: number[]
	selfPairRows: number[]
	duplicateRows: number[]
	isValid: boolean
}

export function parseVendorPairs({
	table,
	columnA,
	columnB,
	recordIdByReference
}: {
	table: CsvTable
	columnA: string
	columnB: string
	recordIdByReference: ReadonlyMap<string, string>
}): VendorPairParse {
	const indexA = table.headers.indexOf(columnA)
	const indexB = table.headers.indexOf(columnB)
	const seen = new Set<string>()
	const result: VendorPairParse = {
		pairs: [],
		unknownReferences: [],
		missingReferenceRows: [],
		selfPairRows: [],
		duplicateRows: [],
		isValid: false
	}
	table.rows.forEach((row, index) => {
		const rowNumber = index + FIRST_DATA_ROW
		const refA = row[indexA] ?? ''
		const refB = row[indexB] ?? ''
		if (refA === '' || refB === '') {
			result.missingReferenceRows.push(rowNumber)
			return
		}
		const idA = recordIdByReference.get(refA)
		const idB = recordIdByReference.get(refB)
		if (idA == null) result.unknownReferences.push({ row: rowNumber, reference: refA })
		if (idB == null) result.unknownReferences.push({ row: rowNumber, reference: refB })
		if (idA == null || idB == null) return
		const pair = canonicalPair(idA, idB)
		if (pair == null) {
			result.selfPairRows.push(rowNumber)
			return
		}
		const key = pairKey(pair)
		if (seen.has(key)) {
			result.duplicateRows.push(rowNumber)
			return
		}
		seen.add(key)
		result.pairs.push(pair)
	})
	result.isValid =
		indexA !== -1 &&
		indexB !== -1 &&
		columnA !== columnB &&
		result.unknownReferences.length === 0 &&
		result.missingReferenceRows.length === 0
	return result
}

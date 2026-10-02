import type { Table } from './tabular'
import { canonicalPair, expandGroup, pairKey, type CanonicalPair } from './pairs'

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
	table: Table
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

// ---- Both formats ----

export type VendorFormat = 'pair' | 'group'

// Which columns hold what. Pair: each row names two records. Group: each row
// puts one record in a group, and records sharing a group are matched.
export type VendorColumns =
	| { format: 'pair'; columnA: string; columnB: string }
	| { format: 'group'; groupColumn: string; referenceColumn: string }

export type VendorFileStats = {
	rows: number
	pairs: number
	// Groups read (group format only).
	groups: number | null
	// The same pair listed again, or a record listed twice in one group.
	duplicates: number
	selfPairs: number
}

export type VendorFileParse = {
	pairs: CanonicalPair[]
	stats: VendorFileStats
	unknownReferences: Array<{ row: number; reference: string }>
	missingReferenceRows: number[]
	// The groups expand past the pair cap.
	tooManyPairs: boolean
	isValid: boolean
}

export function parseVendorFile({
	table,
	columns,
	recordIdByReference,
	maxPairs
}: {
	table: Table
	columns: VendorColumns
	recordIdByReference: ReadonlyMap<string, string>
	maxPairs: number
}): VendorFileParse {
	if (columns.format === 'pair') {
		const result = parseVendorPairs({
			table,
			columnA: columns.columnA,
			columnB: columns.columnB,
			recordIdByReference
		})
		return {
			pairs: result.pairs,
			stats: {
				rows: table.rows.length,
				pairs: result.pairs.length,
				groups: null,
				duplicates: result.duplicateRows.length,
				selfPairs: result.selfPairRows.length
			},
			unknownReferences: result.unknownReferences,
			missingReferenceRows: result.missingReferenceRows,
			tooManyPairs: false,
			isValid: result.isValid
		}
	}
	return parseVendorGroups({
		table,
		groupColumn: columns.groupColumn,
		referenceColumn: columns.referenceColumn,
		recordIdByReference,
		maxPairs
	})
}

// The group format: every pair within a group, each pair once across groups.
// A group of one record has no pairs; a record listed twice in its group
// counts once.
function parseVendorGroups({
	table,
	groupColumn,
	referenceColumn,
	recordIdByReference,
	maxPairs
}: {
	table: Table
	groupColumn: string
	referenceColumn: string
	recordIdByReference: ReadonlyMap<string, string>
	maxPairs: number
}): VendorFileParse {
	const groupIndex = table.headers.indexOf(groupColumn)
	const referenceIndex = table.headers.indexOf(referenceColumn)
	const members = new Map<string, Set<string>>()
	const unknownReferences: Array<{ row: number; reference: string }> = []
	const missingReferenceRows: number[] = []
	let duplicates = 0
	table.rows.forEach((row, index) => {
		const rowNumber = index + FIRST_DATA_ROW
		const group = row[groupIndex] ?? ''
		const reference = row[referenceIndex] ?? ''
		if (group === '' || reference === '') {
			missingReferenceRows.push(rowNumber)
			return
		}
		const id = recordIdByReference.get(reference)
		if (id == null) {
			unknownReferences.push({ row: rowNumber, reference })
			return
		}
		const groupMembers = members.get(group) ?? new Set<string>()
		if (groupMembers.has(id)) duplicates++
		groupMembers.add(id)
		members.set(group, groupMembers)
	})
	const seen = new Map<string, CanonicalPair>()
	for (const groupMembers of members.values()) {
		for (const pair of expandGroup([...groupMembers])) {
			const key = pairKey(pair)
			if (seen.has(key)) duplicates++
			else seen.set(key, pair)
		}
	}
	const pairs = [...seen.values()]
	const tooManyPairs = pairs.length > maxPairs
	return {
		pairs,
		stats: {
			rows: table.rows.length,
			pairs: pairs.length,
			groups: members.size,
			duplicates,
			selfPairs: 0
		},
		unknownReferences,
		missingReferenceRows,
		tooManyPairs,
		isValid:
			groupIndex !== -1 &&
			referenceIndex !== -1 &&
			groupColumn !== referenceColumn &&
			unknownReferences.length === 0 &&
			missingReferenceRows.length === 0 &&
			!tooManyPairs
	}
}

// ---- Working out the format from the file itself ----

// A column holds references when nearly all its values are references in the
// source records; "nearly" leaves room for the odd typo, which then shows up
// as an unknown reference to fix rather than hiding the column.
const REFERENCE_SHARE = 0.9
// A group column has most rows sharing their value with another row.
const GROUPED_SHARE = 0.5
// Name words that say "this column groups records".
const GROUP_WORDS = new Set(['group', 'cluster', 'pair', 'set', 'bucket'])
const ID_WORDS = new Set(['id', 'key', 'no', 'number'])

export type VendorDetection =
	| { columns: VendorColumns }
	| {
			columns: null
			reason: 'no_reference_column' | 'ambiguous_reference' | 'no_group_column' | 'ambiguous_group'
			// The best guess to start the pickers from, when there is one.
			guess: VendorColumns | null
	  }

type ColumnProfile = {
	header: string
	filled: number
	referenceCount: number
	distinct: number
	// Rows whose value appears on another row too.
	grouped: number
}

function profileColumns(table: Table, references: ReadonlySet<string>): ColumnProfile[] {
	return table.headers.map((header, index) => {
		const counts = new Map<string, number>()
		let referenceCount = 0
		for (const row of table.rows) {
			const value = row[index] ?? ''
			if (value === '') continue
			counts.set(value, (counts.get(value) ?? 0) + 1)
			if (references.has(value)) referenceCount++
		}
		const sizes = [...counts.values()]
		return {
			header,
			filled: sizes.reduce((sum, count) => sum + count, 0),
			referenceCount,
			distinct: counts.size,
			grouped: sizes.filter((count) => count > 1).reduce((sum, count) => sum + count, 0)
		}
	})
}

// "PairId" → ["pair", "id"], "Match Definition" → ["match", "definition"].
function nameWords(header: string): string[] {
	return header
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((word) => word !== '')
}

// Word pairs that name the two sides of a pair: left_id / right_id.
const SIDE_WORDS = [
	['left', 'right'],
	['a', 'b'],
	['1', '2'],
	['first', 'second'],
	['source', 'target'],
	['from', 'to']
]

// Whether two column names differ only by their side word, as a pair file's
// two reference columns usually do.
function namesMirror(first: string, second: string): boolean {
	const a = nameWords(first)
	const b = nameWords(second)
	if (a.length !== b.length) return false
	const differing = a.flatMap((word, index) => (word === b[index] ? [] : [[word, b[index] ?? '']]))
	const [pair] = differing
	return (
		differing.length === 1 &&
		pair != null &&
		SIDE_WORDS.some(
			([left, right]) =>
				(pair[0] === left && pair[1] === right) || (pair[0] === right && pair[1] === left)
		)
	)
}

function soundsLikeGroup(header: string): boolean {
	const words = nameWords(header)
	return (
		words.some((word) => GROUP_WORDS.has(word)) ||
		(words.includes('match') && words.some((word) => ID_WORDS.has(word)))
	)
}

// Reads the file against the source references: two reference columns make a
// pair file; one, plus a column whose values repeat, makes a group file.
// Anything less clear comes back with a reason and a best guess, and the user
// picks the columns.
export function detectVendorColumns({
	table,
	references
}: {
	table: Table
	references: ReadonlySet<string>
}): VendorDetection {
	const profiles = profileColumns(table, references)
	const referenceColumns = profiles
		.filter(
			(profile) => profile.filled > 0 && profile.referenceCount / profile.filled >= REFERENCE_SHARE
		)
		.sort((a, b) => b.referenceCount - a.referenceCount)
	const [first, second, third] = referenceColumns
	if (first == null) return { columns: null, reason: 'no_reference_column', guess: null }

	if (second != null) {
		// The file's own column order decides which is first.
		const [columnA = first.header, columnB = second.header] = table.headers.filter(
			(header) => header === first.header || header === second.header
		)
		const pair: VendorColumns = { format: 'pair', columnA, columnB }
		return third == null
			? { columns: pair }
			: { columns: null, reason: 'ambiguous_reference', guess: pair }
	}

	const groupColumns = profiles.filter(
		(profile) =>
			profile.header !== first.header &&
			profile.filled === table.rows.length &&
			profile.distinct > 1 &&
			profile.distinct < profile.filled &&
			profile.grouped / profile.filled >= GROUPED_SHARE
	)
	// A name like PairId or cluster_id outranks a column that only happens to
	// repeat (a state, a score).
	const named = groupColumns.filter((profile) => soundsLikeGroup(profile.header))
	const candidates = named.length > 0 ? named : groupColumns
	const [best, runnerUp] = [...candidates].sort((a, b) => b.distinct - a.distinct)
	if (best == null) {
		// No grouping, but a column named as the reference column's other side
		// (left_id beside right_id): a pair file whose second column has bad
		// references, which then show up as rows to fix.
		const partner = table.headers.find(
			(header) => header !== first.header && namesMirror(header, first.header)
		)
		if (partner == null) return { columns: null, reason: 'no_group_column', guess: null }
		const [columnA = first.header, columnB = partner] = table.headers.filter(
			(header) => header === first.header || header === partner
		)
		return { columns: { format: 'pair', columnA, columnB } }
	}
	const group: VendorColumns = {
		format: 'group',
		groupColumn: best.header,
		referenceColumn: first.header
	}
	return runnerUp == null
		? { columns: group }
		: { columns: null, reason: 'ambiguous_group', guess: group }
}

// A reference as a key whose plain text order is natural order: digit runs
// are zero-padded, so "R2" sorts before "R10". Stored on each record
// (source_records.sortKey) so the database can sort and page by it, and used
// in the app too, so both always agree on which record comes first.
//
// Written as hex: text of only 0-9 and a-f sorts the same under the
// database's own collation as byte by byte (which ignores punctuation and
// folds case otherwise), so its index serves the order with no COLLATE.

// Digit runs longer than this compare as text beyond it; references with
// more digits than this in one run are not real-world.
const DIGIT_WIDTH = 12

export function naturalKey(reference: string): string {
	const padded = reference
		.toLowerCase()
		.replace(/\d+/g, (digits) => digits.padStart(DIGIT_WIDTH, '0'))
	// The original after a separator that sorts first, so two references that
	// differ only in case or leading zeros still have one stable order.
	return hex(`${padded}\u0001${reference}`)
}

const HEX_BASE = 16
const HEX_WIDTH = 2
const utf8 = new TextEncoder()

// UTF-8 bytes in hex: the same order as the bytes themselves.
function hex(text: string): string {
	let out = ''
	for (const byte of utf8.encode(text)) out += byte.toString(HEX_BASE).padStart(HEX_WIDTH, '0')
	return out
}

export function compareNatural(a: string, b: string): number {
	const keyA = naturalKey(a)
	const keyB = naturalKey(b)
	return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
}

// PairSight needs at least 200 records to learn which pairs to check
// (MIN_RECORDS), but each test's own records are a handful written to make
// one point. Uploads add filler records up to PADDED_TO: fictional, each
// value distinct, so no filler looks like another or like the test's own
// records, and the test's pairs are still the ones that matter.

export const PADDED_TO = 220

// Coined, so they never collide with a fixture's real-looking names.
const SYLLABLES = ['qua', 'zel', 'vor', 'nix', 'thu', 'pry', 'oxa', 'wem', 'ilu', 'gry']

function word(index: number, salt: number): string {
	let n = index * 7 + salt
	let text = ''
	for (let part = 0; part < 3; part++) {
		text += SYLLABLES[n % SYLLABLES.length]
		n = Math.floor(n / SYLLABLES.length) + part + salt
	}
	return `${text[0]?.toUpperCase()}${text.slice(1)}${index}`
}

const pad = (value: number, width: number) => String(value).padStart(width, '0')

// A filler value for one column, by what its header looks like.
function fillerValue(header: string, index: number, isIdColumn: boolean): string {
	const name = header.toLowerCase()
	if (isIdColumn) return `F${pad(index, 4)}`
	if (name.includes('first')) return word(index, 1)
	if (name.includes('last') || name.includes('surname')) return word(index, 2)
	if (name.includes('email')) return `filler${index}@filler${index}.test`
	if (name.includes('phone')) return `0161 496 ${pad(index, 4)}`
	if (name.includes('birth') || name.includes('dob')) {
		return `19${pad(30 + (index % 60), 2)}-${pad(1 + (index % 12), 2)}-${pad(1 + (index % 28), 2)}`
	}
	if (name.includes('address')) return `${index} ${word(index, 3)} Road`
	if (name.includes('city')) return `${word(index, 4)}ton`
	if (name.includes('post')) return `ZZ${pad(index % 99, 2)} ${index % 10}XY`
	if (name.includes('website')) return `www.filler${index}.test`
	if (name.includes('company number') || name.includes('registration')) {
		return pad(70_000_000 + index, 8)
	}
	if (name.includes('gtin') || name.includes('barcode')) return `99${pad(index, 11)}`
	if (name.includes('mpn')) return `FLR-${pad(index, 5)}`
	if (name.includes('brand')) return `${word(index, 5)} Works`
	if (name.includes('colour') || name.includes('color')) return word(index, 6)
	if (name.includes('size')) return `${index} cm`
	if (name.includes('name') || name.includes('title')) return `${word(index, 7)} ${word(index, 8)}`
	return ''
}

// The CSV with filler rows added after the fixture's own, up to PADDED_TO.
export function padded(csv: string): string {
	const lines = csv.replace(/\r?\n$/, '').split(/\r?\n/)
	const headers = (lines[0] ?? '').split(',')
	const filler: string[] = []
	for (let index = lines.length; index <= PADDED_TO; index++) {
		filler.push(headers.map((header, column) => fillerValue(header, index, column === 0)).join(','))
	}
	return `${[...lines, ...filler].join('\n')}\n`
}

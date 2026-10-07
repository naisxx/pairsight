// Fictional people at any size, with planted duplicates whose answers are
// known: the yardstick for scaling PairSight (docs/PairSight-Scale-Roadmap.md,
// item 0). Seeded, so the same size always gives the same file. Made up
// entirely; generated on demand, never committed, never sent to Jev.
//
// Surnames follow a long-tail spread like real ones (a few very common,
// many rare), because that's what makes comparison groups grow at scale.

import type { BlockingRecord } from '../../src/server/pairsight/blocking.ts'
import type { KnownDuplicate } from '../../src/server/pairsight/blocking-quality.ts'

export const HEADERS = [
	'record_id',
	'first_name',
	'last_name',
	'email',
	'phone',
	'date_of_birth',
	'address',
	'city',
	'postcode'
] as const

type Row = Record<(typeof HEADERS)[number], string>

const FIRST = [
	'Amelia',
	'Oliver',
	'Isla',
	'George',
	'Ava',
	'Harry',
	'Mia',
	'Noah',
	'Grace',
	'Leo',
	'Freya',
	'Arthur',
	'Ella',
	'Oscar',
	'Lily',
	'Jack',
	'Evie',
	'Henry',
	'Poppy',
	'Theo',
	'Ruby',
	'Alfie',
	'Sophie',
	'Finley',
	'Daisy',
	'Archie',
	'Chloe',
	'Ethan',
	'Millie',
	'Lucas',
	'Emily',
	'James',
	'Hannah',
	'Thomas',
	'Zara',
	'Samuel',
	'Aisha',
	'Daniel',
	'Priya',
	'Mohammed',
	'Wei',
	'Ana',
	'Raj',
	'Fatima',
	'Kofi',
	'Nadia',
	'Sean',
	'Erin',
	'Callum',
	'Megan',
	'Catherine',
	'Stephen',
	'Elizabeth',
	'William',
	'Robert',
	'Jennifer',
	'Michael',
	'Sarah',
	'David',
	'Laura'
]
const COMMON_LAST = [
	'Smith',
	'Jones',
	'Williams',
	'Taylor',
	'Brown',
	'Davies',
	'Evans',
	'Wilson',
	'Thomas',
	'Johnson',
	'Roberts',
	'Robinson',
	'Thompson',
	'Wright',
	'Walker',
	'White',
	'Edwards',
	'Hughes',
	'Green',
	'Hall',
	'Lewis',
	'Harris',
	'Clarke',
	'Patel',
	'Jackson',
	'Wood',
	'Turner',
	'Martin',
	'Cooper',
	'Hill',
	'Ward',
	'Morris',
	'Moore',
	'Clark',
	'Lee',
	'King',
	'Baker',
	'Harrison',
	'Morgan',
	'Allen',
	'James',
	'Scott',
	'Phillips',
	'Watson',
	'Davis',
	'Parker',
	'Price',
	'Bennett',
	'Young',
	'Griffiths'
]
const SYLLABLES = [
	'an',
	'bel',
	'cor',
	'dra',
	'el',
	'fen',
	'gar',
	'hol',
	'ish',
	'jor',
	'kel',
	'lin',
	'mor',
	'nev',
	'or',
	'pel',
	'quin',
	'ros',
	'sel',
	'tor',
	'ul',
	'var',
	'wen',
	'yar',
	'zel'
]
const AREAS = [
	'LS',
	'M',
	'B',
	'BS',
	'NE',
	'SW',
	'EC',
	'G',
	'CF',
	'L',
	'S',
	'NG',
	'LE',
	'SO',
	'PL',
	'EH',
	'AB',
	'CB',
	'OX',
	'YO'
]
const CITY: Record<string, string> = {
	LS: 'Leeds',
	M: 'Manchester',
	B: 'Birmingham',
	BS: 'Bristol',
	NE: 'Newcastle',
	SW: 'London',
	EC: 'London',
	G: 'Glasgow',
	CF: 'Cardiff',
	L: 'Liverpool',
	S: 'Sheffield',
	NG: 'Nottingham',
	LE: 'Leicester',
	SO: 'Southampton',
	PL: 'Plymouth',
	EH: 'Edinburgh',
	AB: 'Aberdeen',
	CB: 'Cambridge',
	OX: 'Oxford',
	YO: 'York'
}
const STREETS = [
	'High St',
	'Park Rd',
	'Mill Lane',
	'Church St',
	'Station Rd',
	'Queen St',
	'Elm Row',
	'Canal St'
]
const DOMAINS = ['example.com', 'example.org', 'example.net', 'mail.test', 'post.test']
const NICKNAMES: Record<string, string> = {
	Elizabeth: 'Liz',
	William: 'Bill',
	Robert: 'Bob',
	Catherine: 'Kate',
	Michael: 'Mike',
	Thomas: 'Tom',
	Daniel: 'Dan',
	Samuel: 'Sam'
}

// Mulberry32: small, fast and seeded, so a size always gives the same people.
export function random(seed: number): () => number {
	let state = seed
	return () => {
		state |= 0
		state = (state + 0x6d2b79f5) | 0
		let t = Math.imul(state ^ (state >>> 15), 1 | state)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

// Share of records that get a planted duplicate, and of those, how many are
// hard (a typo, a move, a new email) rather than easy (same email or phone).
const DUPLICATE_SHARE = 0.1
const HARD_SHARE = 0.4
// Common surnames cover this share of people; the rest get rare ones.
const COMMON_SURNAME_SHARE = 0.6

export function generatePeople(
	size: number,
	seed = 42
): { rows: Row[]; duplicates: KnownDuplicate[] } {
	const next = random(seed)
	const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
	const digits = (count: number) =>
		Array.from({ length: count }, () => Math.floor(next() * 10)).join('')
	// Zipf-like: earlier names in the list are much more common.
	const commonSurname = () => COMMON_LAST[Math.floor(COMMON_LAST.length * next() ** 2)] as string
	const rareSurname = () => {
		const word = pick(SYLLABLES) + pick(SYLLABLES) + (next() < 0.5 ? pick(SYLLABLES) : '')
		return word[0]?.toUpperCase() + word.slice(1)
	}
	const postcode = () => {
		const area = pick(AREAS)
		return `${area}${1 + Math.floor(next() * 20)} ${Math.floor(next() * 10)}${String.fromCharCode(65 + Math.floor(next() * 26))}${String.fromCharCode(65 + Math.floor(next() * 26))}`
	}
	const cityOf = (code: string) => CITY[code.match(/^[A-Z]+/)?.[0] ?? ''] ?? ''
	const birthDate = () =>
		`${1950 + Math.floor(next() * 55)}-${String(1 + Math.floor(next() * 12)).padStart(2, '0')}-${String(1 + Math.floor(next() * 28)).padStart(2, '0')}`

	const rows: Row[] = []
	const duplicates: KnownDuplicate[] = []
	const id = () => `P${String(rows.length + 1).padStart(6, '0')}`
	const person = (fields: Omit<Row, 'record_id'>): Row => {
		const row = { ...fields, record_id: id() }
		rows.push(row)
		return row
	}
	const original = (): Row => {
		const first = pick(FIRST)
		const last = next() < COMMON_SURNAME_SHARE ? commonSurname() : rareSurname()
		const code = postcode()
		return person({
			first_name: first,
			last_name: last,
			email: `${first.toLowerCase()}.${last.toLowerCase()}${digits(3)}@${pick(DOMAINS)}`,
			phone: `07700 9${digits(5)}`,
			date_of_birth: birthDate(),
			address: `${1 + Math.floor(next() * 200)} ${pick(STREETS)}`,
			city: cityOf(code),
			postcode: code
		})
	}
	const typo = (word: string) => {
		if (word.length < 4) return `${word}${word.at(-1) ?? ''}`
		const at = 1 + Math.floor(next() * (word.length - 2))
		return word.slice(0, at) + word[at + 1] + word[at] + word.slice(at + 2)
	}

	while (rows.length < size) {
		const a = original()
		if (rows.length >= size || next() >= DUPLICATE_SHARE) continue
		let b: Row
		let kind: string
		if (next() >= HARD_SHARE) {
			// Easy: the same email, or the same phone, everything else sparse.
			b =
				next() < 0.5
					? person({
							...a,
							email: a.email.toUpperCase(),
							phone: '',
							address: '',
							city: '',
							postcode: '',
							date_of_birth: ''
						})
					: person({ ...a, email: '', date_of_birth: '', phone: a.phone.replace(' ', '') })
			kind = 'easy'
		} else {
			const style = Math.floor(next() * 4)
			const moved = postcode()
			const first = style === 3 ? (NICKNAMES[a.first_name] ?? a.first_name) : a.first_name
			b = person({
				first_name: style === 2 ? a.last_name : first,
				last_name: style === 2 ? a.first_name : style === 0 ? typo(a.last_name) : a.last_name,
				email:
					style === 1
						? `${a.email.split('@')[0]}@${pick(DOMAINS)}`
						: `${first.toLowerCase()}${digits(2)}@${pick(DOMAINS)}`,
				phone: '',
				date_of_birth: style === 3 ? '' : a.date_of_birth,
				address: `${1 + Math.floor(next() * 200)} ${pick(STREETS)}`,
				city: cityOf(moved),
				postcode: style === 1 ? a.postcode : moved
			})
			kind =
				['hard: typo', 'hard: new email provider', 'hard: names swapped', 'hard: nickname, moved'][
					style
				] ?? 'hard'
		}
		duplicates.push({ recordA: a.record_id, recordB: b.record_id, kind })
	}
	return { rows, duplicates }
}

export function toCsv(rows: Row[]): string {
	const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
	return [HEADERS.join(','), ...rows.map((row) => HEADERS.map((h) => cell(row[h])).join(','))].join(
		'\n'
	)
}

export function toRecords(rows: Row[]): BlockingRecord[] {
	return rows.map((row) => {
		const fields: BlockingRecord['fields'] = {}
		for (const header of HEADERS) {
			if (header !== 'record_id' && row[header] !== '') fields[header] = row[header]
		}
		return { id: row.record_id, fields }
	})
}

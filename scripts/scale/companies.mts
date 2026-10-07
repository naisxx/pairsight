// Fictional organisations at any size, with planted duplicates whose answers
// are known: the yardstick for PairSight's organisation suggestions
// (docs/PairSight-Scale-Roadmap.md, item 10). Seeded, so the same size always
// gives the same file. Made up entirely, on reserved or fictional numbers and
// domains; generated on demand, never committed, never sent to Jev.
//
// Names come from a few common words (so different firms share names, as real
// ones do) and many coined ones. The hard duplicates are the ones a records
// team actually meets: a typo, a legal suffix written another way, a firm
// filed under its trading name, and a firm that moved and changed website.

import type { ScoringRecord } from '../../src/server/pairsight/scoring-records.ts'
import { random, type KnownDuplicate } from './people.mts'

export const COMPANY_HEADERS = [
	'record_id',
	'company_name',
	'trading_name',
	'registration_number',
	'tax_id',
	'website',
	'email',
	'phone',
	'address',
	'city',
	'postcode',
	'industry'
] as const

type Row = Record<(typeof COMPANY_HEADERS)[number], string>

const COMMON_WORDS = [
	'Granite',
	'Harbour',
	'Northgate',
	'Oakridge',
	'Bluebell',
	'Copper',
	'Meadow',
	'Falcon',
	'Linden',
	'Summit',
	'Riverside',
	'Kingsway',
	'Ashford',
	'Beacon',
	'Crown',
	'Phoenix',
	'Sterling',
	'Westfield',
	'Highland',
	'Evergreen'
]
const TRADES: Array<{ word: string; industry: string }> = [
	{ word: 'Foods', industry: 'Food and drink' },
	{ word: 'Logistics', industry: 'Transport' },
	{ word: 'Builders', industry: 'Construction' },
	{ word: 'Media', industry: 'Media' },
	{ word: 'Supplies', industry: 'Wholesale' },
	{ word: 'Systems', industry: 'Software' },
	{ word: 'Health', industry: 'Healthcare' },
	{ word: 'Energy', industry: 'Energy' },
	{ word: 'Engineering', industry: 'Engineering' },
	{ word: 'Consulting', industry: 'Professional services' },
	{ word: 'Print', industry: 'Printing' },
	{ word: 'Interiors', industry: 'Retail' },
	{ word: 'Travel', industry: 'Travel' },
	{ word: 'Security', industry: 'Security' },
	{ word: 'Electrical', industry: 'Construction' },
	{ word: 'Recruitment', industry: 'Professional services' }
]
const SYLLABLES = [
	'al',
	'bri',
	'cor',
	'dex',
	'el',
	'fen',
	'gal',
	'hex',
	'ion',
	'jun',
	'kor',
	'lum',
	'mar',
	'nex',
	'or',
	'pra',
	'quo',
	'rin',
	'sol',
	'tav',
	'ux',
	'ven',
	'wex',
	'yon',
	'zan'
]
// Legal suffixes, and how a second system might write each one.
const SUFFIXES: Array<[string, string]> = [
	['Ltd', 'Limited'],
	['Limited', 'Ltd.'],
	['PLC', 'Public Limited Company'],
	['LLP', 'L.L.P.'],
	['Ltd', 'LTD']
]
const AREAS: Array<{ area: string; city: string; dial: string }> = [
	{ area: 'LS', city: 'Leeds', dial: '0113' },
	{ area: 'M', city: 'Manchester', dial: '0161' },
	{ area: 'B', city: 'Birmingham', dial: '0121' },
	{ area: 'BS', city: 'Bristol', dial: '0117' },
	{ area: 'NE', city: 'Newcastle', dial: '0191' },
	{ area: 'EC', city: 'London', dial: '020' },
	{ area: 'G', city: 'Glasgow', dial: '0141' },
	{ area: 'CF', city: 'Cardiff', dial: '029' },
	{ area: 'S', city: 'Sheffield', dial: '0114' },
	{ area: 'NG', city: 'Nottingham', dial: '0115' },
	{ area: 'EH', city: 'Edinburgh', dial: '0131' },
	{ area: 'SO', city: 'Southampton', dial: '023' }
]
const STREETS = [
	'Commerce Way',
	'Mill Lane',
	'Station Rd',
	'Enterprise Park',
	'King St',
	'Quayside',
	'Canal Wharf',
	'Market Sq'
]

// Share of records that get a planted duplicate, and of those, how many are
// hard rather than easy (the same company number or website).
const DUPLICATE_SHARE = 0.1
const HARD_SHARE = 0.4
// Firms named from the common words, rather than a coined name: with 320
// such names, about this share of firms share their name with others.
const COMMON_NAME_SHARE = 0.25
// How often each identifier is filled in: real files are patchy.
const FILLED = { registration: 0.7, tax: 0.5, website: 0.6, email: 0.5, phone: 0.8, trading: 0.3 }

export function generateCompanies(
	size: number,
	seed = 42
): { rows: Row[]; duplicates: KnownDuplicate[] } {
	const next = random(seed)
	const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
	const digits = (count: number) =>
		Array.from({ length: count }, () => Math.floor(next() * 10)).join('')
	const maybe = (share: number, value: string) => (next() < share ? value : '')
	const coined = () => {
		const word = pick(SYLLABLES) + pick(SYLLABLES) + (next() < 0.5 ? pick(SYLLABLES) : '')
		return word[0]?.toUpperCase() + word.slice(1)
	}
	const place = () => {
		const where = pick(AREAS)
		const postcode = `${where.area}${1 + Math.floor(next() * 20)} ${Math.floor(next() * 10)}${String.fromCharCode(65 + Math.floor(next() * 26))}${String.fromCharCode(65 + Math.floor(next() * 26))}`
		return { ...where, postcode }
	}
	const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

	const rows: Row[] = []
	const duplicates: KnownDuplicate[] = []
	const id = () => `C${String(rows.length + 1).padStart(6, '0')}`
	const add = (fields: Omit<Row, 'record_id'>): Row => {
		const row = { ...fields, record_id: id() }
		rows.push(row)
		return row
	}

	// Each original also keeps what its duplicate needs to know.
	const original = () => {
		const trade = pick(TRADES)
		const isCommon = next() < COMMON_NAME_SHARE
		const core = isCommon ? pick(COMMON_WORDS) : coined()
		const andSons = next() < 0.15
		const name = `${core}${andSons ? ' & Sons' : ''} ${trade.word}`
		const isGroup = next() < FILLED.trading
		const [suffix, otherSuffix] = pick(SUFFIXES)
		const legal = `${name}${isGroup ? ' Holdings' : ''} ${suffix}`
		const where = place()
		// Firms sharing a name never share a website: theirs carries a place
		// or a number ("granitefoodsleeds.example").
		const slug = isCommon
			? `${slugOf(name)}${next() < 0.5 ? slugOf(where.city) : digits(3)}`
			: slugOf(name)
		const row = add({
			company_name: legal,
			trading_name: isGroup ? name : '',
			registration_number: maybe(FILLED.registration, `${digits(8)}`),
			tax_id: maybe(FILLED.tax, `GB${digits(9)}`),
			website: maybe(FILLED.website, `www.${slug}.example`),
			email: maybe(FILLED.email, `${pick(['info', 'accounts', 'hello'])}@${slug}.example`),
			phone: maybe(FILLED.phone, `${where.dial} 496 ${digits(4)}`),
			address: `${1 + Math.floor(next() * 200)} ${pick(STREETS)}`,
			city: where.city,
			postcode: where.postcode,
			industry: trade.industry
		})
		return { row, name, legal, otherSuffix, isGroup, andSons, slug }
	}
	const typo = (word: string) => {
		if (word.length < 4) return `${word}${word.at(-1) ?? ''}`
		const at = 1 + Math.floor(next() * (word.length - 2))
		return word.slice(0, at) + word[at + 1] + word[at] + word.slice(at + 2)
	}
	const sparse = {
		registration_number: '',
		tax_id: '',
		website: '',
		email: '',
		phone: ''
	}

	while (rows.length < size) {
		const a = original()
		if (rows.length >= size || next() >= DUPLICATE_SHARE) continue
		let b: Row
		let kind: string
		if (next() >= HARD_SHARE) {
			// Easy: the same company number or website, written another way;
			// little else filled in.
			const withNumber = a.row.registration_number !== '' && next() < 0.5
			b = add({
				...a.row,
				...sparse,
				company_name: a.row.company_name.toUpperCase(),
				trading_name: '',
				address: '',
				...(withNumber
					? { registration_number: a.row.registration_number.replace(/^(\d{4})/, '$1 ') }
					: { website: `https://${a.slug}.example/` })
			})
			kind = 'easy'
		} else {
			const style = Math.floor(next() * 4)
			const moved = place()
			const [firstWord = '', ...rest] = a.legal.split(' ')
			const legalWithout = a.legal.replace(/ (Ltd|Limited|PLC|LLP)$/, '')
			b = add({
				...a.row,
				...sparse,
				trading_name: '',
				company_name:
					style === 0
						? [typo(firstWord), ...rest].join(' ')
						: style === 1
							? `${(a.andSons ? legalWithout.replace(' & ', ' and ') : legalWithout).toUpperCase()} ${a.otherSuffix}`
							: style === 2
								? a.name
								: a.legal,
				// Moved: a new address, in another city for the last kind.
				...(style === 3
					? {
							city: moved.city,
							postcode: moved.postcode,
							address: `${1 + Math.floor(next() * 200)} ${pick(STREETS)}`,
							website: `www.${a.slug}uk.example`
						}
					: style === 1
						? {
								postcode: moved.postcode.replace(
									/^[A-Z]+/,
									a.row.postcode.match(/^[A-Z]+/)?.[0] ?? ''
								)
							}
						: {})
			})
			kind =
				[
					'hard: typo, no ids',
					'hard: suffix and "&" written differently',
					'hard: filed under trading name',
					'hard: moved, new website'
				][style] ?? 'hard'
			// Filed under its trading name only makes sense for a group; any
			// other firm gets its legal name without the suffix.
			if (style === 2 && !a.isGroup) kind = 'hard: suffix dropped'
		}
		duplicates.push({ recordA: a.row.record_id, recordB: b.record_id, kind })
	}
	return { rows, duplicates }
}

export function companyRecords(rows: Row[]): ScoringRecord[] {
	return rows.map((row) => {
		const fields: ScoringRecord['fields'] = {}
		for (const header of COMPANY_HEADERS) {
			if (header !== 'record_id' && row[header] !== '') fields[header] = row[header]
		}
		return { id: row.record_id, fields }
	})
}

export function companiesCsv(rows: Row[]): string {
	const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
	return [
		COMPANY_HEADERS.join(','),
		...rows.map((row) => COMPANY_HEADERS.map((header) => cell(row[header])).join(','))
	].join('\n')
}

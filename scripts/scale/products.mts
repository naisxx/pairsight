// Fictional products at any size, with planted duplicates whose answers are
// known, and variant traps: the yardstick for PairSight's product suggestions
// (docs/PairSight-Scale-Roadmap.md, item 10). Seeded, so the same size always
// gives the same file. Made up entirely; generated on demand, never committed,
// never sent to Jev.
//
// Products come in families (one line from one brand) of one to four
// variants: another size or colour is a different product, with its own
// barcode and part number. Pairs of variants are the traps: they look alike
// and must not count as duplicates (Jev's "same product" question).

import type { BlockingRecord } from '../../src/server/pairsight/blocking.ts'
import type { KnownDuplicate } from '../../src/server/pairsight/blocking-quality.ts'
import { random } from './people.mts'

export const PRODUCT_HEADERS = [
	'record_id',
	'product_name',
	'brand',
	'manufacturer',
	'gtin',
	'mpn',
	'sku',
	'model_number',
	'category',
	'color',
	'size'
] as const

type Row = Record<(typeof PRODUCT_HEADERS)[number], string>

const KINDS: Array<{ kind: string; category: string; sizes: readonly string[] }> = [
	{ kind: 'Kettle', category: 'Kitchen', sizes: ['1.5L', '1.7L'] },
	{ kind: 'Toaster', category: 'Kitchen', sizes: ['2 Slice', '4 Slice'] },
	{ kind: 'Blender', category: 'Kitchen', sizes: ['600W', '1000W'] },
	{ kind: 'Coffee Maker', category: 'Kitchen', sizes: ['1.2L', '1.8L'] },
	{ kind: 'Headphones', category: 'Audio', sizes: [] },
	{ kind: 'Speaker', category: 'Audio', sizes: ['Mini', 'Max'] },
	{ kind: 'Soundbar', category: 'Audio', sizes: ['2.1', '5.1'] },
	{ kind: 'Desk Lamp', category: 'Home', sizes: ['Small', 'Large'] },
	{ kind: 'Fan', category: 'Home', sizes: ['12in', '16in'] },
	{ kind: 'Heater', category: 'Home', sizes: ['1kW', '2kW'] },
	{ kind: 'Drill', category: 'Tools', sizes: ['12V', '18V'] },
	{ kind: 'Sander', category: 'Tools', sizes: [] },
	{ kind: 'Hair Dryer', category: 'Personal care', sizes: ['1800W', '2200W'] },
	{ kind: 'Shaver', category: 'Personal care', sizes: [] }
]
const COLORS = ['Black', 'White', 'Silver', 'Red', 'Blue', 'Matt Grey']
const SYLLABLES = [
	'no',
	'va',
	'ar',
	'ia',
	'ter',
	'lu',
	'men',
	've',
	'or',
	'so',
	'ki',
	'te',
	'zen',
	'ri',
	'ca',
	'el',
	'dor',
	'fi',
	'mo',
	'xa'
]
const TIERS = ['', '', '', ' Pro', ' Mini', ' Plus', ' Classic']

// Share of records that get a planted duplicate, and of those, how many are
// hard rather than easy (the same barcode).
const DUPLICATE_SHARE = 0.1
const HARD_SHARE = 0.4
const BRAND_COUNT = 60
// Brands owned by one parent: this many brands per manufacturer.
const BRANDS_PER_MAKER = 3
// How often each identifier is filled in.
const FILLED = { gtin: 0.85, mpn: 0.75, sku: 0.6, model: 0.4 }
const GTIN_BODY_LENGTH = 12
const CHECK_DIGIT_MODULUS = 10
const ODD_POSITION_WEIGHT = 3

// A valid EAN-13: the body plus its GS1 check digit.
function ean13(body: string): string {
	let sum = 0
	for (let index = 0; index < body.length; index += 1) {
		const digit = Number(body[body.length - 1 - index])
		sum += index % 2 === 0 ? digit * ODD_POSITION_WEIGHT : digit
	}
	return `${body}${(CHECK_DIGIT_MODULUS - (sum % CHECK_DIGIT_MODULUS)) % CHECK_DIGIT_MODULUS}`
}

export function generateProducts(
	size: number,
	seed = 42
): { rows: Row[]; duplicates: KnownDuplicate[]; traps: KnownDuplicate[] } {
	const next = random(seed)
	const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
	const digits = (count: number) =>
		Array.from({ length: count }, () => Math.floor(next() * 10)).join('')
	const word = (parts: number) => {
		const text = Array.from({ length: parts }, () => pick(SYLLABLES)).join('')
		return text[0]?.toUpperCase() + text.slice(1)
	}
	const brands = Array.from({ length: BRAND_COUNT }, (_, index) => ({
		name: `${word(2 + (index % 2))}${index % 5 === 0 ? ' Home' : ''}`,
		code: '',
		maker: ''
	}))
	for (const [index, brand] of brands.entries()) {
		brand.code = brand.name
			.replace(/[^A-Za-z]/g, '')
			.slice(0, 3)
			.toUpperCase()
		brand.maker = `${(brands[index - (index % BRANDS_PER_MAKER)] ?? brand).name.split(' ')[0]} Group`
	}
	// Zipf-like: a few brands make most of the products.
	const pickBrand = () => brands[Math.floor(BRAND_COUNT * next() ** 2)] ?? brands[0]

	const rows: Row[] = []
	const duplicates: KnownDuplicate[] = []
	const traps: KnownDuplicate[] = []
	const id = () => `G${String(rows.length + 1).padStart(6, '0')}`
	const add = (fields: Omit<Row, 'record_id'>): Row => {
		const row = { ...fields, record_id: id() }
		rows.push(row)
		return row
	}
	const typo = (text: string) => {
		if (text.length < 4) return `${text}${text.at(-1) ?? ''}`
		const at = 1 + Math.floor(next() * (text.length - 2))
		return text.slice(0, at) + text[at + 1] + text[at] + text.slice(at + 2)
	}

	while (rows.length < size) {
		const brand = pickBrand()
		if (brand == null) break
		const kind = pick(KINDS)
		const name = `${word(2)}${pick(TIERS)} ${kind.kind}`
		const model = next() < FILLED.model ? `${brand.code}${digits(3)}` : ''
		// One to four variants: the sizes, or colours when it has none.
		const sizes = kind.sizes.length > 0 && next() < 0.6 ? kind.sizes : ['']
		const colors =
			sizes.length > 1
				? [pick(COLORS)]
				: Array.from({ length: 1 + Math.floor(next() * 3) }, () => pick(COLORS))
		const familyRows: Row[] = []
		// Which variant each record is: a duplicate is its original's variant.
		const variantOf = new Map<string, string>()
		const familyCode = digits(4)
		for (const [sizeIndex, variantSize] of sizes.entries()) {
			for (const [colorIndex, color] of [...new Set(colors)].entries()) {
				if (rows.length >= size) break
				const variant = `${sizeIndex}${colorIndex}`
				const a = add({
					product_name: name,
					brand: brand.name,
					manufacturer: next() < 0.5 ? brand.maker : '',
					gtin: next() < FILLED.gtin ? ean13(`50${digits(GTIN_BODY_LENGTH - 2)}`) : '',
					mpn: next() < FILLED.mpn ? `${brand.code}-${familyCode}-${variant}` : '',
					sku: next() < FILLED.sku ? digits(7) : '',
					model_number: model,
					category: kind.category,
					color,
					size: variantSize
				})
				familyRows.push(a)
				variantOf.set(a.record_id, variant)
				if (rows.length >= size || next() >= DUPLICATE_SHARE) continue
				let b: Row
				let duplicateKind: string
				if (next() >= HARD_SHARE && a.gtin !== '') {
					// Easy: the same barcode; the name in another case, its own SKU.
					b = add({
						...a,
						product_name: a.product_name.toUpperCase(),
						mpn: '',
						sku: digits(7),
						manufacturer: ''
					})
					duplicateKind = 'easy'
				} else {
					const style = Math.floor(next() * 4)
					const words = a.product_name.split(' ')
					b = add({
						...a,
						gtin: '',
						sku: digits(7),
						manufacturer: '',
						mpn: style === 0 ? a.mpn.replace(/-/g, '').toLowerCase() : style === 2 ? a.mpn : '',
						product_name:
							style === 1
								? next() < 0.5
									? typo(a.product_name)
									: [...words.slice(1), words[0]].join(' ')
								: a.product_name,
						brand: style === 2 ? brand.name.toUpperCase().replace(' HOME', '') + ' Ltd' : a.brand,
						size: style === 3 ? '' : a.size,
						color: style === 3 ? '' : a.color
					})
					duplicateKind =
						[
							'hard: no barcode, part number reformatted',
							'hard: name retyped, no codes',
							'hard: brand written differently',
							'hard: name and brand only'
						][style] ?? 'hard'
				}
				duplicates.push({ recordA: a.record_id, recordB: b.record_id, kind: duplicateKind })
				familyRows.push(b)
				variantOf.set(b.record_id, variant)
			}
		}
		// Every pair across two variants of the family is a trap.
		for (const [index, first] of familyRows.entries()) {
			for (const second of familyRows.slice(index + 1)) {
				if (variantOf.get(first.record_id) !== variantOf.get(second.record_id)) {
					traps.push({ recordA: first.record_id, recordB: second.record_id, kind: 'variant' })
				}
			}
		}
	}
	return { rows, duplicates, traps }
}

export function productRecords(rows: Row[]): BlockingRecord[] {
	return rows.map((row) => {
		const fields: BlockingRecord['fields'] = {}
		for (const header of PRODUCT_HEADERS) {
			if (header !== 'record_id' && row[header] !== '') fields[header] = row[header]
		}
		return { id: row.record_id, fields }
	})
}

export function productsCsv(rows: Row[]): string {
	const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
	return [
		PRODUCT_HEADERS.join(','),
		...rows.map((row) => PRODUCT_HEADERS.map((header) => cell(row[header])).join(','))
	].join('\n')
}

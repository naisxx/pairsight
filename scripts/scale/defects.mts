// The mess real files carry, planted into the generated records so the
// benchmark can show what profiling the records is worth
// (docs/PairSight-Scale-Roadmap.md, item 12). Off unless asked for
// (export.mts --defects), and seeded apart from the generators, so the clean
// files stay exactly as items 5 and 10 measured them.
//
// Placeholders and shared values go into every kind of record, not only the
// duplicates: their harm is strangers agreeing, which only shows across the
// whole file. Every value is fictional: reserved phone ranges and
// .example domains.

import type { EntityType } from '../../src/lib/pairsight/entity-types.ts'
import type { MappedFields } from '../../src/server/pairsight/normalize.ts'
import type { ScoringRecord } from '../../src/server/pairsight/scoring-records.ts'
import { random, type KnownDuplicate } from './people.mts'

// Apart from the generators' seed, so planting defects never shifts them.
const SEED_OFFSET = 1_000
// Share of records given a placeholder in one field ("N/A", all zeros, …).
const PLACEHOLDER_SHARE = 0.05
// Share of records given the one value many records share (a switchboard).
const SHARED_SHARE = 0.03
// Share of phones whose leading 0 a spreadsheet dropped.
const LOST_ZERO_SHARE = 0.1
// Share of people from Ireland, with Irish phones written the Irish way.
const ABROAD_SHARE = 0.05
// Share of dates of birth written "12 Apr 1990" rather than "12/04/1990".
const WORDY_DATE_SHARE = 0.15

type Role = keyof MappedFields
type Plan = {
	placeholders: Partial<Record<Role, readonly string[]>>
	shared: Partial<Record<Role, string>>
	phones: boolean
	dates: boolean
}

const PLANS: Record<EntityType, Plan> = {
	person: {
		placeholders: {
			email: ['N/A', 'unknown', 'test@test.com', 'noreply@example.com'],
			phone: ['0', '00000000000', 'N/A'],
			date_of_birth: ['1900-01-01']
		},
		shared: { phone: '0113 496 0000' },
		phones: true,
		dates: true
	},
	company: {
		placeholders: {
			registration_number: ['00000000', 'N/A'],
			tax_id: ['N/A', 'none'],
			website: ['N/A', 'www.example.com'],
			email: ['test@test.com', 'N/A'],
			phone: ['0', 'N/A']
		},
		shared: { phone: '0113 496 0000', email: 'accounts@sharedservices.example' },
		phones: true,
		dates: false
	},
	product: {
		placeholders: {
			gtin: ['0000000000000', 'N/A'],
			mpn: ['N/A', '-', 'TBC'],
			sku: ['-', 'N/A']
		},
		shared: { sku: '000' },
		phones: false,
		dates: false
	}
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Each record's defects, by record id, for score.py's per-defect table.
export type PlantedDefects = Map<string, string[]>

export function plantDefects(
	records: ScoringRecord[],
	duplicates: KnownDuplicate[],
	type: EntityType,
	seed: number
): { records: ScoringRecord[]; defects: PlantedDefects } {
	const next = random(seed + SEED_OFFSET)
	const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
	const digits = (count: number) =>
		Array.from({ length: count }, () => Math.floor(next() * 10)).join('')
	const plan = PLANS[type]
	const defects: PlantedDefects = new Map()
	const mark = (id: string, defect: string) => defects.set(id, [...(defects.get(id) ?? []), defect])
	const out = records.map((record) => ({ id: record.id, fields: { ...record.fields } }))
	const byId = new Map(out.map((record) => [record.id, record]))

	// Irish people: both of a duplicate pair live there, one writing the
	// phone the Irish way (087 …), the other in full (+353 87 …). Chosen
	// first, so the phone defects below leave their numbers alone.
	const abroad = new Set<string>()
	if (plan.phones && type === 'person') {
		const partner = new Map<string, string>()
		for (const { recordA, recordB } of duplicates) {
			partner.set(recordA, recordB)
			partner.set(recordB, recordA)
		}
		for (const record of out) {
			if (abroad.has(record.id) || next() >= ABROAD_SHARE) continue
			const local = `87 ${digits(3)} ${digits(4)}`
			const twin = byId.get(partner.get(record.id) ?? '')
			for (const [index, person] of [record, twin].entries()) {
				if (person == null) continue
				abroad.add(person.id)
				person.fields.country = 'Ireland'
				if (person.fields.phone != null) {
					person.fields.phone = index === 0 ? `0${local}` : `+353 ${local}`
					mark(person.id, 'Irish phone')
				}
			}
		}
	}

	for (const record of out) {
		const { fields } = record
		const filled = (Object.keys(plan.placeholders) as Role[]).filter(
			(role) => fields[role] != null && !(role === 'phone' && abroad.has(record.id))
		)
		if (filled.length > 0 && next() < PLACEHOLDER_SHARE) {
			const role = pick(filled)
			fields[role] = pick(plan.placeholders[role] ?? [])
			mark(record.id, 'placeholder')
		}
		for (const [role, value] of Object.entries(plan.shared) as [Role, string][]) {
			if (!abroad.has(record.id) && next() < SHARED_SHARE) {
				fields[role] = value
				mark(record.id, 'shared value')
			}
		}
		const phone = fields.phone
		if (
			plan.phones &&
			!abroad.has(record.id) &&
			phone?.startsWith('0') &&
			phone.length > 4 &&
			next() < LOST_ZERO_SHARE
		) {
			fields.phone = phone.replace(/\s/g, '').slice(1)
			mark(record.id, 'phone lost its leading 0')
		}
		// Every date of birth written day first, as a UK file would.
		const birth = plan.dates ? fields.date_of_birth?.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null
		if (birth != null) {
			const [, year, month, day] = birth
			fields.date_of_birth =
				next() < WORDY_DATE_SHARE
					? `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
					: `${day}/${month}/${year}`
		}
	}
	return { records: out, defects }
}

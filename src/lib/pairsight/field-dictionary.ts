import { ENTITY_TYPES, rolesFor, type EntityType, type IdentityRole } from './entity-types'
import { FIELD_SYNONYMS, QUALIFIER_WORDS, REFERENCE_SYNONYMS } from './field-synonyms'
import { isValidGtin } from './gtin'

// Suggests what each column of an upload holds, and what kind of records the
// file is: from the column names (field-synonyms.ts) and a look at the first
// rows' values. Only suggestions — the mapping screen marks them "Suggested"
// until the user confirms. Pure and client-safe.

// How sure a match is. A whole-name match beats one found after dropping a
// qualifier ("Billing Postcode"), which beats a phrase found inside a longer
// name ("Primary Email Address").
const SCORE = {
	exact: 3,
	qualified: 2.5,
	containedBase: 1,
	containedPerWord: 0.25,
	// Values that look right confirm a name match, or suggest a role for a
	// column whose name says nothing ("col7" full of emails).
	valuesConfirm: 1.5,
	valuesAlone: 1.5,
	// The least a column needs to be suggested at all.
	minimum: 1
} as const

// Shares of a column's sample values: most must look right to confirm, and
// almost none for the values to rule a role out.
const CONFIRM_SHARE = 0.8
const ALONE_SHARE = 0.9
const VETO_SHARE = 0.2
const MIN_VETO_SAMPLES = 3

// Single words that are clear enough to find inside a longer column name.
// Others ("name", "last", "type", "post") only count as the whole name, so
// "Last updated" isn't a surname and "Record type" isn't a category.
const CONTAINED_WORDS = new Set([
	'email',
	'mail',
	'phone',
	'telephone',
	'mobile',
	'dob',
	'birthdate',
	'birthday',
	'postcode',
	'zipcode',
	'zip',
	'city',
	'town',
	'country',
	'address',
	'street',
	'website',
	'url',
	'domain',
	'surname',
	'forename',
	'firstname',
	'lastname',
	'fullname',
	'gtin',
	'ean',
	'upc',
	'barcode',
	'isbn',
	'sku',
	'mpn',
	'brand',
	'manufacturer',
	'vat',
	'duns',
	'lei',
	'colour',
	'color',
	'industry',
	'sector'
])

// A column name as words: camelCase and run-together digits split,
// punctuation and accents gone, lowercase.
export function normalizeHeader(header: string): string {
	return header
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/([a-zA-Z])(\d)/g, '$1 $2')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
}

function words(text: string): string[] {
	return text === '' ? [] : text.split(' ')
}

function containsPhrase(haystack: string[], phrase: string[]): boolean {
	if (phrase.length === 0 || phrase.length > haystack.length) return false
	for (let start = 0; start + phrase.length <= haystack.length; start += 1) {
		if (phrase.every((word, index) => haystack[start + index] === word)) return true
	}
	return false
}

// How well a column name says it holds this role: 0 when it doesn't.
export function headerScore(header: string, role: IdentityRole): number {
	const name = normalizeHeader(header)
	const phrases = FIELD_SYNONYMS[role]
	if (phrases.includes(name)) return SCORE.exact
	const nameWords = words(name)
	const unqualified = nameWords.filter((word) => !QUALIFIER_WORDS.includes(word)).join(' ')
	if (unqualified !== '' && unqualified !== name && phrases.includes(unqualified)) {
		return SCORE.qualified
	}
	let best = 0
	for (const phrase of phrases) {
		const phraseWords = words(phrase)
		const clearEnough = phraseWords.length > 1 || CONTAINED_WORDS.has(phrase)
		if (!clearEnough || !containsPhrase(nameWords, phraseWords)) continue
		best = Math.max(best, SCORE.containedBase + SCORE.containedPerWord * phraseWords.length)
	}
	return best
}

// ---- Values ----

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const WEBSITE = /^(https?:\/\/)?(www\d?\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i
const PHONE = /^\+?[\d\s().-]{7,20}$/
const MIN_PHONE_DIGITS = 7
const DATE = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(\s.*)?$/

// What a value of the role looks like, for the roles that have a clear shape.
const VALUE_SHAPES: Partial<Record<IdentityRole, (value: string) => boolean>> = {
	email: (value) => EMAIL.test(value),
	website: (value) => !value.includes('@') && WEBSITE.test(value),
	phone: (value) => PHONE.test(value) && value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS,
	date_of_birth: (value) => DATE.test(value),
	gtin: (value) => isValidGtin(value.replace(/[\s-]/g, ''))
}

// Values so unmistakable they name the column by themselves.
const SELF_EVIDENT: ReadonlySet<IdentityRole> = new Set(['email', 'website', 'gtin'])

function shareMatching(values: string[], test: (value: string) => boolean): number | null {
	const filled = values.map((value) => value.trim()).filter((value) => value !== '')
	if (filled.length === 0) return null
	return filled.filter(test).length / filled.length
}

// A column's score for a role: its name, adjusted by what its values look like.
export function columnScore(header: string, values: string[], role: IdentityRole): number {
	const fromName = headerScore(header, role)
	const shape = VALUE_SHAPES[role]
	const share = shape == null ? null : shareMatching(values, shape)
	if (share == null) return fromName
	const filled = values.filter((value) => value.trim() !== '').length
	if (fromName > 0 && fromName < SCORE.exact && share < VETO_SHARE && filled >= MIN_VETO_SAMPLES) {
		return 0
	}
	if (fromName > 0 && share >= CONFIRM_SHARE) return fromName + SCORE.valuesConfirm
	if (fromName === 0 && SELF_EVIDENT.has(role) && share >= ALONE_SHARE) return SCORE.valuesAlone
	return fromName
}

export type Suggestion = { role: IdentityRole; score: number }

// The best role for each column of a type: each role goes to one column (the
// strongest), each column gets at most one role.
export function suggestFields({
	headers,
	rows,
	type,
	skip
}: {
	headers: string[]
	rows: string[][]
	type: EntityType
	// The reference column, which holds no field.
	skip?: string
}): Map<string, Suggestion> {
	const candidates: Array<{ header: string; role: IdentityRole; score: number }> = []
	headers.forEach((header, index) => {
		if (header === skip) return
		const values = rows.map((row) => row[index] ?? '')
		for (const role of rolesFor(type)) {
			const score = columnScore(header, values, role)
			if (score >= SCORE.minimum) candidates.push({ header, role, score })
		}
	})
	// Strongest first; on a tie the plainer name ("Email" over "Work Email").
	const length = (header: string) => words(normalizeHeader(header)).length
	candidates.sort((a, b) => b.score - a.score || length(a.header) - length(b.header))
	const byHeader = new Map<string, Suggestion>()
	const taken = new Set<IdentityRole>()
	for (const { header, role, score } of candidates) {
		if (byHeader.has(header) || taken.has(role)) continue
		byHeader.set(header, { role, score })
		taken.add(role)
	}
	return byHeader
}

// The column that holds each record's own identifier: an id-looking name,
// else a name ending in "id" / "ref", else the first column.
export function suggestReferenceColumn(headers: string[]): string | undefined {
	const named = headers.find((header) => REFERENCE_SYNONYMS.includes(normalizeHeader(header)))
	if (named != null) return named
	const idLike = headers.find((header) => /\b(id|ref|reference|key)$/.test(normalizeHeader(header)))
	return idLike ?? headers[0]
}

// ---- What kind of records ----

// Fields only one type has: they say most about what a file holds. Shared
// ones (email, phone, the address lines) say little.
const DISTINCT_WEIGHT = 1
const SHARED_WEIGHT = 0.25
// A best type this far ahead of the next is a confident guess; closer, the
// screen asks.
const CONFIDENT_LEAD = 1.5
const CONFIDENT_MINIMUM = 3

const LEGAL_FORM = /\b(ltd|limited|inc|llc|llp|plc|gmbh|corp|corporation|s\.?a|b\.?v|ag|pty)\.?$/i
const LEGAL_FORM_SHARE = 0.2
const LEGAL_FORM_WEIGHT = 2
// A column plainly named for a person ("Full Name", "Surname", "DOB"): the
// file is about people, and an "Acme Ltd" column beside it is their employer.
// Qualified names don't count: "Contact Name" belongs in company files too.
const PERSON_ROLES: readonly IdentityRole[] = [
	'full_name',
	'first_name',
	'last_name',
	'date_of_birth'
]
const PERSON_NAME_WEIGHT = LEGAL_FORM_WEIGHT

function namesAPerson(header: string): boolean {
	const name = normalizeHeader(header)
	if (name === 'name' || words(name).some((word) => QUALIFIER_WORDS.includes(word))) return false
	return PERSON_ROLES.some((role) => FIELD_SYNONYMS[role].includes(name))
}

function typesWithRole(role: IdentityRole): number {
	return ENTITY_TYPES.filter((type) => rolesFor(type).includes(role)).length
}

export type TypeDetection = {
	type: EntityType
	confident: boolean
	scores: Record<EntityType, number>
}

// Scores the file as each type: the fields it would map, weighted towards
// fields unique to the type, plus names ending in a legal form ("Acme Ltd")
// for organisations, unless a column is plainly a person's name. Ties go to
// people, as before types existed.
export function detectEntityType({
	headers,
	rows,
	skip
}: {
	headers: string[]
	rows: string[][]
	skip?: string
}): TypeDetection {
	const scoreAs = (type: EntityType) => {
		let total = 0
		for (const { role, score } of suggestFields({ headers, rows, type, skip }).values()) {
			total += score * (typesWithRole(role) === 1 ? DISTINCT_WEIGHT : SHARED_WEIGHT)
		}
		return total
	}
	const scores: Record<EntityType, number> = {
		person: scoreAs('person'),
		company: scoreAs('company'),
		product: scoreAs('product')
	}
	const personNamed = headers.some((header) => header !== skip && namesAPerson(header))
	if (personNamed) scores.person += PERSON_NAME_WEIGHT
	const legalForms = headers.some((header, index) => {
		if (header === skip) return false
		const share = shareMatching(
			rows.map((row) => row[index] ?? ''),
			(value) => LEGAL_FORM.test(value)
		)
		return share != null && share >= LEGAL_FORM_SHARE
	})
	if (legalForms && !personNamed) scores.company += LEGAL_FORM_WEIGHT

	// The highest score wins; people win a tie.
	const type = ENTITY_TYPES.reduce((best, candidate) =>
		scores[candidate] > scores[best] ? candidate : best
	)
	const runnerUp = Math.max(
		...ENTITY_TYPES.filter((candidate) => candidate !== type).map((candidate) => scores[candidate])
	)
	const confident = scores[type] >= CONFIDENT_MINIMUM && scores[type] >= runnerUp * CONFIDENT_LEAD
	return { type, confident, scores }
}

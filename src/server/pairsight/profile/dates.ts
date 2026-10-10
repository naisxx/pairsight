// Dates as uploaded ("12/04/1990", "12 Apr 1990", "1990-04-12") read as one
// ISO date, so two records agree on a date of birth however each wrote it.
// The order of a numeric date is a property of the whole column, not one
// value: "12/04/1990" is April or December depending on the file
// (detectDateOrder, profile.ts).

// Day first ("12/04/1990" is 12 April) or month first (US: 4 December).
export type DateOrder = 'dmy' | 'mdy'

// Matched on the lowercased value, so the time's "T" is a "t".
const ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ t].*)?$/
const NUMERIC = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/
const DAY_MONTH_YEAR = /^(\d{1,2})(?:st|nd|rd|th)?[ -]([a-z]{3,9})\.?,?[ -](\d{2}|\d{4})$/
const MONTH_DAY_YEAR = /^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{2}|\d{4})$/

const MONTHS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
]
// "sept" as well as "sep": both are common.
const SHORT_MONTH_LENGTH = 3
const MONTHS_IN_YEAR = 12
const CENTURY = 100

function monthOf(word: string): number | null {
	if (word === 'sept') return MONTHS.indexOf('september') + 1
	const index = MONTHS.findIndex(
		(month) => word.length >= SHORT_MONTH_LENGTH && month.startsWith(word)
	)
	return index === -1 ? null : index + 1
}

// A two-digit year is this century's if that's not in the future, else the
// last century's: right for dates of birth, the only dates read here.
function fullYear(year: string, now: Date): number {
	const value = Number(year)
	if (year.length === 4) return value
	const thisYear = now.getUTCFullYear()
	const century = thisYear - (thisYear % CENTURY)
	return century + value > thisYear ? century - CENTURY + value : century + value
}

function iso(year: number, month: number, day: number): string | null {
	if (month < 1 || month > MONTHS_IN_YEAR || day < 1) return null
	const date = new Date(Date.UTC(year, month - 1, day))
	// Rejects 31 April, 29 February outside a leap year, and so on.
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
	return date.toISOString().slice(0, 10)
}

// One date as ISO (YYYY-MM-DD), or null when it isn't a date. A numeric date
// whose order the column didn't settle (order null) reads day first unless
// only month first makes sense.
export function parseDate(
	value: string,
	order: DateOrder | null,
	now: Date = new Date()
): string | null {
	const text = value.trim().toLowerCase()
	const isoMatch = ISO.exec(text)
	if (isoMatch) return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
	const numeric = NUMERIC.exec(text)
	if (numeric) {
		const [first, second] = [Number(numeric[1]), Number(numeric[2])]
		const year = fullYear(numeric[3] ?? '', now)
		const monthFirst =
			order === 'mdy' || (order == null && first <= MONTHS_IN_YEAR && second > MONTHS_IN_YEAR)
		return monthFirst ? iso(year, first, second) : iso(year, second, first)
	}
	const dayFirst = DAY_MONTH_YEAR.exec(text)
	if (dayFirst) {
		const month = monthOf(dayFirst[2] ?? '')
		return month == null ? null : iso(fullYear(dayFirst[3] ?? '', now), month, Number(dayFirst[1]))
	}
	const monthFirst = MONTH_DAY_YEAR.exec(text)
	if (monthFirst) {
		const month = monthOf(monthFirst[1] ?? '')
		return month == null
			? null
			: iso(fullYear(monthFirst[3] ?? '', now), month, Number(monthFirst[2]))
	}
	return null
}

// What a column's numeric dates say about their order: a first part over 12
// can only be a day, a second part over 12 only a day too.
export function dateOrderEvidence(value: string): DateOrder | null {
	const numeric = NUMERIC.exec(value.trim())
	if (!numeric) return null
	if (Number(numeric[1]) > MONTHS_IN_YEAR) return 'dmy'
	if (Number(numeric[2]) > MONTHS_IN_YEAR) return 'mdy'
	return null
}

// Whether a value is a numeric date whose order matters ("04/12/1990").
export function isNumericDate(value: string): boolean {
	return NUMERIC.test(value.trim())
}

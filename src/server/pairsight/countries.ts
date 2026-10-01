import 'server-only'
import { getCountries } from 'libphonenumber-js/min'

// The countries the Rules screen offers: every one the phone normaliser can
// read local numbers for, by name, stored as its two-letter code.
export function countryOptions(locale: string): Array<{ value: string; label: string }> {
	const names = new Intl.DisplayNames([locale], { type: 'region' })
	return getCountries()
		.map((code) => ({ value: code, label: names.of(code) ?? code }))
		.sort((a, b) => a.label.localeCompare(b.label, locale))
}

import { getCountries, type CountryCode } from 'libphonenumber-js/min'

// A record's own country, read from its country cell ("GB", "Ireland",
// "United States"), so its phone number is read the way that country writes
// it. Unknown or blank: the evaluation's country.

// Names English files commonly use that aren't the country's own name.
const ALIASES: Record<string, CountryCode> = {
	uk: 'GB',
	'u.k.': 'GB',
	england: 'GB',
	scotland: 'GB',
	wales: 'GB',
	'northern ireland': 'GB',
	'great britain': 'GB',
	britain: 'GB',
	gbr: 'GB',
	usa: 'US',
	'u.s.': 'US',
	'u.s.a.': 'US',
	'united states of america': 'US',
	america: 'US',
	irl: 'IE',
	'republic of ireland': 'IE',
	eire: 'IE',
	uae: 'AE',
	deu: 'DE',
	fra: 'FR',
	esp: 'ES',
	ita: 'IT',
	nld: 'NL',
	can: 'CA',
	aus: 'AU',
	ind: 'IN'
}

let names: Map<string, CountryCode> | null = null

function countryNames(): Map<string, CountryCode> {
	if (names != null) return names
	const display = new Intl.DisplayNames('en', { type: 'region' })
	const built = new Map<string, CountryCode>(Object.entries(ALIASES))
	for (const code of getCountries()) {
		built.set(code.toLowerCase(), code)
		const name = display.of(code)
		if (name != null) built.set(name.toLowerCase(), code)
	}
	names = built
	return built
}

export function regionFor(country: string | undefined, fallback: string): string {
	const key = country?.trim().toLowerCase().replace(/\s+/g, ' ')
	if (key == null || key === '') return fallback
	return countryNames().get(key) ?? fallback
}

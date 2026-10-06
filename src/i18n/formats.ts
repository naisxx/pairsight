import type { Formats } from 'next-intl'

// How every count on screen is written: three significant figures, with
// K and M past a thousand (999, 1.2K, 12.3K, 1.23M), so big numbers stay easy
// to read. The exact figure is a hover away (src/components/ui/count.tsx).
// Messages write a count as `{count, number, compact}`; components use
// <Count> or `format.number(value, 'compact')`. src/i18n/copy.test.mts fails
// on a count placeholder that skips it.
export const COMPACT_COUNT = {
	notation: 'compact',
	maximumSignificantDigits: 3
} as const satisfies Intl.NumberFormatOptions

// The same count in full (1,234,567), for the hover.
export const EXACT_COUNT = { maximumFractionDigits: 0 } as const satisfies Intl.NumberFormatOptions

// From here a compact count can differ from the exact one.
export const COMPACT_FROM = 1_000

export const formats = {
	number: { compact: COMPACT_COUNT, exact: EXACT_COUNT }
} as const satisfies Formats

declare module 'next-intl' {
	interface AppConfig {
		Formats: typeof formats
	}
}

// Passed as a message's formats to write its counts in full: the exact text
// for a hover over a sentence whose counts are shortened.
export const EXACT_FORMATS = { number: { compact: EXACT_COUNT } } as const

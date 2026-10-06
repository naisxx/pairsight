import { useFormatter } from 'next-intl'
import { COMPACT_FROM } from '@/i18n/formats'

// A count as the app writes every count (src/i18n/formats.ts): 999, 1.2K,
// 1.23M, with the exact figure on hover once it's shortened. Works in server
// and client components alike.
export function Count({ value, className }: { value: number; className?: string }) {
	const format = useFormatter()
	const compact = format.number(value, 'compact')
	return (
		<span
			className={className}
			title={Math.abs(value) >= COMPACT_FROM ? format.number(value, 'exact') : undefined}
		>
			{compact}
		</span>
	)
}

// The exact count, for a hover beside a shortened one; undefined when the
// shortened one is already exact.
export function useExactCount() {
	const format = useFormatter()
	return (value: number) =>
		Math.abs(value) >= COMPACT_FROM ? format.number(value, 'exact') : undefined
}

// The hover for a sentence whose counts are shortened: its exact text
// (`exact`, the message rendered with EXACT_FORMATS), or nothing when no
// count in it is shortened.
export function exactTitle(counts: number[], exact: () => string): string | undefined {
	return counts.some((value) => Math.abs(value) >= COMPACT_FROM) ? exact() : undefined
}

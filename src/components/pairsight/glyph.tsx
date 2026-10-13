import { cn } from '@/lib/cn'

export type GlyphKind = 'same' | 'different' | 'missing' | 'check'

// Ice for things that hold, vermilion for caveats and disagreements, grey for
// a value that's missing (pairsight-handoff Foundations, "Same and
// different"). The category tints, so they keep contrast in both themes.
const KINDS: Record<GlyphKind, { symbol: string; className: string }> = {
	same: { symbol: '=', className: 'bg-cat-pairsight-subtle text-cat-pairsight' },
	different: { symbol: '≠', className: 'bg-cat-vendor-subtle text-cat-vendor' },
	missing: { symbol: '–', className: 'bg-surface-muted text-text-muted' },
	// A check that passed (Records, what PairSight checked).
	check: { symbol: '✓', className: 'bg-cat-pairsight-subtle text-cat-pairsight' }
}

// The equals and not-equals tile that labels a row or a section. It repeats
// what the words beside it say, so it's hidden from screen readers.
export function Glyph({ kind, className }: { kind: GlyphKind; className?: string }) {
	const { symbol, className: tone } = KINDS[kind]
	return (
		<span
			aria-hidden
			className={cn(
				'inline-flex size-7 shrink-0 items-center justify-center rounded-sm font-mono font-semibold',
				tone,
				className
			)}
		>
			{symbol}
		</span>
	)
}

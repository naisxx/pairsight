import { cn } from '@/lib/cn'

// Text wordmark until a real logo exists (docs/PairSight-UX-Plan.md §11):
// two overlapping records in the brand coral, then the name.
export function Wordmark({
	className,
	labelClassName
}: {
	className?: string
	// Lets the collapsed sidebar fade the name while the glyph stays.
	labelClassName?: string
}) {
	return (
		<span className={cn('text-text inline-flex items-center gap-2 font-semibold', className)}>
			<svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0" aria-hidden>
				<circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--action)" strokeWidth="2.5" />
				<circle cx="16" cy="8" r="6.5" fill="none" stroke="var(--action)" strokeWidth="2.5" />
			</svg>
			<span className={labelClassName}>PairSight</span>
		</span>
	)
}

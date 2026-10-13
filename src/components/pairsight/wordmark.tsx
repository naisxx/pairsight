import { cn } from '@/lib/cn'

// The mark: three tiles in a row — the vendor (vermilion), agreement (the
// text colour, so ink on paper and paper on charcoal) and the checker (ice).
export function LogoGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 28 8" className={cn('h-2.5 w-[34px] shrink-0', className)} aria-hidden>
			<rect x="0" y="0" width="8" height="8" rx="2" className="fill-brand" />
			<rect x="10" y="0" width="8" height="8" rx="2" fill="currentColor" />
			<rect x="20" y="0" width="8" height="8" rx="2" className="fill-ice" />
		</svg>
	)
}

export function Wordmark({
	className,
	labelClassName
}: {
	className?: string
	// Lets a tight spot hide the name while the mark stays.
	labelClassName?: string
}) {
	return (
		<span className={cn('text-text inline-flex items-center gap-2.5', className)}>
			<LogoGlyph />
			<span
				className={cn(
					'font-display text-[1.375rem] leading-none font-semibold tracking-[-0.025em]',
					labelClassName
				)}
			>
				PairSight
			</span>
		</span>
	)
}

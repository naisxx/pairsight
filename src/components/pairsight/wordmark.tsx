import { cn } from '@/lib/cn'

// The mark: two overlapping records, the first filled with two lines of
// "data", in the fixed brand coral (both themes).
export function LogoGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 22 16" className={cn('h-4 w-[22px] shrink-0', className)} aria-hidden>
			<rect x="1" y="1" width="12" height="14" rx="3" className="fill-brand" />
			<rect
				x="9"
				y="1"
				width="12"
				height="14"
				rx="3"
				fill="none"
				strokeWidth="2"
				className="stroke-brand"
			/>
			<path
				d="M4.5 6h5M4.5 10h3.5"
				strokeWidth="1.6"
				strokeLinecap="round"
				className="stroke-white"
			/>
		</svg>
	)
}

export function Wordmark({
	className,
	labelClassName
}: {
	className?: string
	// Lets the collapsed sidebar hide the name while the glyph stays.
	labelClassName?: string
}) {
	return (
		<span className={cn('text-text inline-flex items-center gap-2', className)}>
			<LogoGlyph />
			<span className={cn('text-[0.9375rem] font-semibold tracking-[-0.01em]', labelClassName)}>
				PairSight
			</span>
		</span>
	)
}

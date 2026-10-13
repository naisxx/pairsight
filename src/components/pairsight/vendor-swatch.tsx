import { cn } from '@/lib/cn'

// Each vendor's colour, by its place in the upload order: blue, plum, then
// grey for a third. The same on every screen (Vendors, Check and start,
// Home, Results, the list and the pair), whichever vendor ranks first, so a
// vendor keeps one colour throughout.
const VENDOR_COLOURS = ['bg-series-a', 'bg-series-b', 'bg-text-muted']

export function VendorSwatch({ index, className }: { index: number; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				'inline-block size-2.5 shrink-0 rounded-[3px]',
				VENDOR_COLOURS[index % VENDOR_COLOURS.length],
				className
			)}
		/>
	)
}

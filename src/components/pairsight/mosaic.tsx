import type { Category } from '@/lib/pairsight/decisions'
import { MOSAIC_COLUMNS, type Mosaic as MosaicData } from '@/lib/pairsight/mosaic'
import { cn } from '@/lib/cn'

// The mosaic's colours: ink where both say same, vermilion where only the
// vendor does, ice where only Jev does, and the hairline grey where both say
// different. Shared with the legends beside it.
export const MOSAIC_TILE: Record<Category, string> = {
	both_matched: 'bg-text',
	vendor_only: 'bg-brand',
	pairsight_only: 'bg-ice',
	neither_matched: 'bg-border'
}

// How long a tile waits per tile of distance from the middle when the
// colours change (the landing's ripple), and how much wider than tall that
// distance is measured, matching the layout's ellipse.
const RIPPLE_STEP_MS = 40
const RIPPLE_ELLIPSE = 1.5

function rippleDelay(index: number, rows: number): number {
	const x = index % MOSAIC_COLUMNS
	const y = Math.floor(index / MOSAIC_COLUMNS)
	const distance = Math.hypot((x - (MOSAIC_COLUMNS - 1) / 2) / RIPPLE_ELLIPSE, y - (rows - 1) / 2)
	return Math.round(distance * RIPPLE_STEP_MS)
}

// One tile per checked pair (or per bucket of pairs on a big run), laid out
// by mosaicOf (lib/pairsight/mosaic.ts). A true chart, so it has a label;
// the legend beside it carries the counts. With `ripple`, a change of colour
// spreads from the middle outwards (each tile's delay is `--d`; the landing's
// stylesheet times it). With `pop`, a tile grows under the pointer, and a
// legend item hovered beside it shades out the other categories' tiles
// (`data-tile`; motion.css).
export function Mosaic({
	mosaic,
	label,
	ripple = false,
	pop = false,
	className
}: {
	mosaic: MosaicData
	label: string
	ripple?: boolean
	pop?: boolean
	className?: string
}) {
	const rows = Math.ceil(mosaic.tiles.length / MOSAIC_COLUMNS)
	return (
		<div role="img" aria-label={label} className={cn('grid grid-cols-22 gap-[3px]', className)}>
			{mosaic.tiles.map((category, index) => (
				<span
					// The layout is fixed for a given set of counts, so a tile's place is its identity.
					key={index}
					style={ripple ? { '--d': `${rippleDelay(index, rows)}ms` } : undefined}
					data-tile={pop ? category : undefined}
					className={cn(
						'aspect-square rounded-xs duration-200',
						pop
							? 'transition-[background-color,opacity,scale] ease-out hover:relative hover:z-[1] motion-safe:hover:scale-150'
							: 'transition-[background-color]',
						MOSAIC_TILE[category]
					)}
				/>
			))}
		</div>
	)
}

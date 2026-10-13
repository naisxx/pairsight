import { cn } from '@/lib/cn'
import type { ResultCategory } from '@/server/pairsight/results'

// Category styling means agreement, never right or wrong (docs/PairSight-UX-Plan.md
// §6): its own palette, never brand or status colors, and a shape as well as a
// color so it survives grayscale and color-blindness.
const CATEGORY_DOT: Record<ResultCategory, string> = {
	pairsight_only: 'bg-cat-pairsight rounded-full',
	vendor_only: 'bg-cat-vendor rotate-45 rounded-[1px]',
	both_matched: 'bg-cat-both rounded-[1px]',
	neither_matched: 'border-cat-neither rounded-full border-[1.5px]',
	incomplete: 'border-text-muted rounded-full border-[1.5px] border-dashed'
}

export function CategoryDot({
	category,
	className
}: {
	category: ResultCategory
	className?: string
}) {
	return (
		<span
			aria-hidden
			className={cn('inline-block size-2.5 shrink-0', CATEGORY_DOT[category], className)}
		/>
	)
}

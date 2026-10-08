import { useTranslations } from 'next-intl'
import { AlertIcon, SpinnerIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { failureReason } from '@/lib/pairsight/failure-reasons'
import type { ResultCategory } from '@/server/pairsight/results'

// Category styling means agreement, never right or wrong (docs/PairSight-UX-Plan.md
// §6): its own palette, never brand or status colors, and a shape as well as a
// color so it survives grayscale and color-blindness.
export const CATEGORY_STYLES: Record<
	ResultCategory,
	{ badge: string; dot: string; tile: string; fill: string }
> = {
	pairsight_only: {
		badge: 'bg-cat-pairsight-subtle text-cat-pairsight',
		dot: 'bg-cat-pairsight rounded-full',
		tile: 'border-cat-pairsight/50',
		fill: 'bg-cat-pairsight'
	},
	vendor_only: {
		badge: 'bg-cat-vendor-subtle text-cat-vendor',
		dot: 'bg-cat-vendor rotate-45 rounded-[1px]',
		tile: 'border-cat-vendor/50',
		fill: 'bg-cat-vendor'
	},
	both_matched: {
		badge: 'bg-cat-both-subtle text-cat-both',
		dot: 'bg-cat-both rounded-[1px]',
		tile: 'border-border',
		fill: 'bg-cat-both'
	},
	neither_matched: {
		badge: 'bg-cat-neither-subtle text-cat-neither',
		dot: 'border-cat-neither rounded-full border-[1.5px]',
		tile: 'border-border',
		fill: 'bg-cat-neither'
	},
	incomplete: {
		badge: 'border-border-input text-text-muted border border-dashed',
		dot: 'border-text-muted rounded-full border-[1.5px] border-dashed',
		tile: 'border-border border-dashed',
		fill: 'bg-surface-muted'
	}
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
			className={cn('inline-block size-2.5 shrink-0', CATEGORY_STYLES[category].dot, className)}
		/>
	)
}

export function CategoryBadge({ category }: { category: ResultCategory }) {
	const t = useTranslations('Categories')
	return (
		<span
			className={cn(
				'inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium whitespace-nowrap',
				CATEGORY_STYLES[category].badge
			)}
		>
			<CategoryDot category={category} />
			{t(category)}
		</span>
	)
}

export function StatusChip({
	status,
	errorCode
}: {
	status: 'pending' | 'running' | 'failed'
	errorCode?: string | null
}) {
	const t = useTranslations('Results')
	const tFailures = useTranslations('Failures')
	return (
		<span
			className={cn(
				'type-meta inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium whitespace-nowrap',
				status === 'failed' ? 'bg-danger-subtle text-danger' : 'bg-surface-muted text-text-muted'
			)}
			// The raw code stays available for whoever is debugging.
			title={errorCode ?? undefined}
		>
			{status === 'failed' ? (
				<AlertIcon size={12} />
			) : status === 'running' ? (
				<SpinnerIcon size={12} />
			) : null}
			{t(status)}
			{status === 'failed' && (
				<span className="opacity-80">· {tFailures(failureReason(errorCode))}</span>
			)}
		</span>
	)
}

const DEFAULT_BAR_WIDTH_PX = 64
const PERCENT = 100

// A 0–1 score as a short bar with the threshold as a tick, then the number.
// The number is always shown; the bar only helps reading it against the
// threshold at a glance. `size="lg"` is the pair page's full-width version.
export function ScoreBar({
	score,
	threshold,
	width = DEFAULT_BAR_WIDTH_PX,
	showValue = true,
	size = 'sm',
	className
}: {
	score: number
	threshold: number
	width?: number
	showValue?: boolean
	size?: 'sm' | 'lg'
	className?: string
}) {
	const isLarge = size === 'lg'
	return (
		<span className={cn('inline-flex items-center gap-2', isLarge && 'w-full', className)}>
			<span
				aria-hidden
				className={cn(
					'bg-border relative inline-block rounded-full',
					isLarge ? 'h-2.5 flex-1' : 'h-1.5'
				)}
				style={isLarge ? undefined : { width }}
			>
				{/* Grey up to the cut-off, ink past it: where the score crosses
				    the line shows as a change of colour, not only as the tick. */}
				<span
					className="score-fill bg-border-input absolute inset-y-0 left-0 rounded-full"
					style={{ width: `${Math.min(score, threshold) * PERCENT}%` }}
				/>
				{score > threshold && (
					<span
						className="score-fill bg-text absolute inset-y-0 rounded-r-full"
						style={{
							left: `${threshold * PERCENT}%`,
							width: `${(score - threshold) * PERCENT}%`
						}}
					/>
				)}
				{/* The cut-off: a thick coral tick, outlined in the surface colour so
				    it stands clear of the fill on either side. */}
				<span
					className={cn(
						'bg-action ring-surface absolute w-[3px] -translate-x-1/2 rounded-full ring-2',
						isLarge ? '-top-1 -bottom-1' : '-top-[5px] -bottom-[5px]'
					)}
					style={{ left: `${threshold * PERCENT}%` }}
				/>
			</span>
			{showValue && (
				<span
					className={cn(
						'text-text font-mono',
						isLarge ? 'text-base leading-6 font-semibold' : 'type-ui'
					)}
				>
					{score.toFixed(2)}
				</span>
			)}
		</span>
	)
}

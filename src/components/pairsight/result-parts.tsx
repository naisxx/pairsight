import { useTranslations } from 'next-intl'
import { AlertIcon, SpinnerIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { ResultCategory } from '@/server/pairsight/results'

// Category styling means agreement, never right or wrong (docs/PairSight-UX-Plan.md
// §6): its own palette, never brand or status colors, and a shape as well as a
// color so it survives grayscale and color-blindness.
export const CATEGORY_STYLES: Record<ResultCategory, { badge: string; dot: string; tile: string }> =
	{
		pairsight_only: {
			badge: 'bg-cat-pairsight-subtle text-cat-pairsight',
			dot: 'bg-cat-pairsight rounded-full',
			tile: 'border-cat-pairsight/50'
		},
		vendor_only: {
			badge: 'bg-cat-vendor-subtle text-cat-vendor',
			dot: 'bg-cat-vendor rotate-45 rounded-[1px]',
			tile: 'border-cat-vendor/50'
		},
		both_matched: {
			badge: 'bg-cat-both-subtle text-cat-both',
			dot: 'bg-cat-both rounded-[1px]',
			tile: 'border-border'
		},
		neither_matched: {
			badge: 'bg-cat-neither-subtle text-cat-neither',
			dot: 'border-cat-neither rounded-full border-[1.5px]',
			tile: 'border-border'
		},
		incomplete: {
			badge: 'border-border-input text-text-muted border border-dashed',
			dot: 'border-text-muted rounded-full border-[1.5px] border-dashed',
			tile: 'border-border border-dashed'
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
				'type-meta inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium whitespace-nowrap',
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
	return (
		<span
			className={cn(
				'type-meta inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium whitespace-nowrap',
				status === 'failed' ? 'bg-danger-subtle text-danger' : 'bg-surface-muted text-text-muted'
			)}
			title={errorCode ?? undefined}
		>
			{status === 'failed' ? (
				<AlertIcon size={12} />
			) : status === 'running' ? (
				<SpinnerIcon size={12} />
			) : null}
			{t(status)}
			{status === 'failed' && errorCode != null && (
				<span className="type-data-sm opacity-80">· {errorCode}</span>
			)}
		</span>
	)
}

// A 0–1 score bar with a tick at the threshold. The number is always shown;
// the bar only helps reading it against the threshold at a glance.
export function ScoreBar({
	score,
	threshold,
	size = 'sm'
}: {
	score: number
	threshold: number
	size?: 'sm' | 'lg'
}) {
	const isMatch = score >= threshold
	return (
		<span className={cn('inline-flex items-center gap-2', size === 'lg' ? 'w-full' : 'w-32')}>
			<span
				className={cn(
					'bg-surface-muted relative block flex-1 overflow-visible rounded-full',
					size === 'lg' ? 'h-2.5' : 'h-1.5'
				)}
				aria-hidden
			>
				<span
					className={cn(
						'absolute inset-y-0 left-0 rounded-full',
						isMatch ? 'bg-text' : 'bg-text-muted/60'
					)}
					style={{ width: `${Math.round(score * 100)}%` }}
				/>
				<span
					className="bg-action absolute -inset-y-1 w-0.5 rounded-full"
					style={{ left: `calc(${threshold * 100}% - 1px)` }}
				/>
			</span>
			<span
				className={cn(
					'text-text',
					size === 'lg' ? 'type-data text-base leading-6 font-semibold' : 'type-data-sm'
				)}
			>
				{score.toFixed(2)}
			</span>
		</span>
	)
}

import { useTranslations } from 'next-intl'
import { AlertIcon, WarningCircleIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

const ICON_SIZE = 15
const FULL_PERCENT = 100

export type RulesSummaryData = {
	fromRules: number
	vendorOnly: number
	total: number
	limit: number
	raw: number
	largest: number
	oversized: Array<{ rule: string; size: number }>
}

// What the saved rules add up to: candidates from the rules, vendor-only
// additions, the total against the pair limit, and how much the rules
// overlap. It follows the last save, so it says when a change is on its way.
export function RulesSummary({
	summary,
	isUpdating
}: {
	summary: RulesSummaryData
	isUpdating: boolean
}) {
	const t = useTranslations('Rules')
	const isOver = summary.total > summary.limit
	const percent = Math.min(FULL_PERCENT, (summary.total / summary.limit) * FULL_PERCENT)
	return (
		<aside
			aria-labelledby="summary-title"
			className="border-border bg-surface rounded-md border lg:sticky lg:top-4"
		>
			<header className="flex items-center justify-between px-4 pt-3.5 pb-1">
				<h2 id="summary-title" className="text-sm font-semibold">
					{t('summaryTitle')}
				</h2>
				{isUpdating && <span className="text-text-muted type-caption">{t('summaryUpdating')}</span>}
			</header>
			<dl
				aria-live="polite"
				className={cn('type-ui space-y-2 px-4 py-2 transition-opacity', isUpdating && 'opacity-60')}
			>
				<div className="flex justify-between">
					<dt className="text-text-muted">{t('summaryFromRules')}</dt>
					<dd className="font-mono">{summary.fromRules}</dd>
				</div>
				<div className="flex justify-between">
					<dt className="text-text-muted">{t('summaryVendor')}</dt>
					<dd className="font-mono">+{summary.vendorOnly}</dd>
				</div>
				<div className="border-border flex justify-between border-t pt-2">
					<dt className="font-medium">{t('summaryTotal')}</dt>
					<dd className={cn('font-mono font-semibold', isOver && 'text-danger')}>
						{summary.total}
					</dd>
				</div>
			</dl>
			<div className="px-4 pb-3">
				<div
					role="progressbar"
					aria-label={t('summaryLimitAria')}
					aria-valuenow={summary.total}
					aria-valuemin={0}
					aria-valuemax={summary.limit}
					className="bg-surface-muted h-1.5 overflow-hidden rounded-full"
				>
					<div
						className={cn(
							'h-full rounded-full transition-[width] duration-200 ease-out',
							isOver ? 'bg-danger' : 'bg-text'
						)}
						style={{ width: `${percent}%` }}
					/>
				</div>
				<p className="text-text-muted mt-1.5 flex justify-between text-xs">
					<span>{t('summaryLimit')}</span>
					<span className="font-mono">
						{summary.total} / {summary.limit}
					</span>
				</p>
			</div>
			<dl className="border-border space-y-1.5 border-t px-4 py-3 text-xs">
				<div className="flex justify-between">
					<dt className="text-text-muted">{t('summaryRaw')}</dt>
					<dd className="font-mono">{summary.raw}</dd>
				</div>
				<div className="flex justify-between">
					<dt className="text-text-muted">{t('summaryOverlaps')}</dt>
					<dd className="font-mono">{Math.max(0, summary.raw - summary.fromRules)}</dd>
				</div>
				<div className="flex justify-between">
					<dt className="text-text-muted">{t('summaryLargest')}</dt>
					<dd className="font-mono">{t('summaryLargestValue', { count: summary.largest })}</dd>
				</div>
			</dl>
			{(isOver || summary.oversized.length > 0) && (
				<div className="border-border space-y-2 border-t px-4 py-3">
					{isOver && (
						<p
							role="alert"
							className="bg-danger-subtle text-danger flex gap-2 rounded-sm p-2.5 text-xs"
						>
							<WarningCircleIcon size={ICON_SIZE} className="mt-px shrink-0" />
							{t('summaryOver', { count: summary.total - summary.limit })}
						</p>
					)}
					{summary.oversized.map((item) => (
						<p
							key={item.rule}
							className="bg-warning-subtle text-warning flex gap-2 rounded-sm p-2.5 text-xs"
						>
							<AlertIcon size={ICON_SIZE} className="mt-px shrink-0" />
							{t('summaryOversized', { rule: item.rule, size: item.size })}
						</p>
					))}
				</div>
			)}
			<p className="border-border text-text-muted border-t px-4 py-3 text-xs leading-relaxed">
				{t('summaryNote')}
			</p>
		</aside>
	)
}

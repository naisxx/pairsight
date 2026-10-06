'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, SlidersIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import type { Category } from '@/lib/pairsight/decisions'
import { statsHistogram, statsMetrics, statsMetricsAt, type StatsRow } from '@/lib/pairsight/stats'
import { cn } from '@/lib/cn'
import { CategoryDot } from './result-parts'
import { formatShare } from './results/overview/chart-theme'
import { Count } from '@/components/ui/count'

const STEP = 0.01
const PERCENT = 100
// A bin with any pairs stays visible next to a much taller one.
const MIN_BAR_PERCENT = 4
const ORDER: Category[] = ['both_matched', 'pairsight_only', 'vendor_only', 'neither_matched']

function clampToStep(value: number): number {
	return Math.min(1, Math.max(0, Math.round(value * PERCENT) / PERCENT))
}

// The run's decision threshold, behind a button showing its value. The
// popover shows how the vendor's judged scores spread around it and previews
// every count and metric at another threshold: a "what if", never saved.
// Each run keeps the threshold it started with; a different one is set in
// Rules and takes a new run, which reuses every saved score
// (docs/PairSight-UX-Plan.md, "What shipped").
export function ThresholdControl({
	threshold,
	rulesHref,
	vendorName,
	stats
}: {
	threshold: number
	rulesHref: string
	vendorName: string
	// The run's counts for this vendor, as vendor 0 (stats.ts
	// `statsForVendor`): exact at every 0.01 step the control offers.
	stats: StatsRow[]
}) {
	const t = useTranslations('Results')
	const tCat = useTranslations('Categories')
	const tOverview = useTranslations('Overview')
	const [isOpen, setIsOpen] = useState(false)
	const [draft, setDraft] = useState(threshold)
	const [text, setText] = useState(threshold.toFixed(2))
	const notAvailable = tOverview('notAvailable')

	const bins = statsHistogram(stats, 0)
	const tallest = Math.max(1, ...bins.map((bin) => bin.matched + bin.notMatched))
	const current = statsMetrics(stats, 0)
	// The run's own threshold may have more decimals than a step.
	const preview = draft === threshold ? current : statsMetricsAt(stats, 0, draft)
	const rows: Array<{
		key: string
		label: string
		dot?: Category
		from: React.ReactNode
		to: React.ReactNode
		changed: boolean
	}> = [
		{
			key: 'matches',
			label: t('pairsightMatches'),
			from: <Count value={current.tp + current.fn} />,
			to: <Count value={preview.tp + preview.fn} />,
			changed: current.tp + current.fn !== preview.tp + preview.fn
		},
		...ORDER.map((category) => ({
			key: category,
			label: tCat(category),
			dot: category,
			from: <Count value={current.counts[category]} />,
			to: <Count value={preview.counts[category]} />,
			changed: current.counts[category] !== preview.counts[category]
		})),
		{
			key: 'precision',
			label: tOverview('precisionLabel'),
			from: formatShare(current.precision, notAvailable),
			to: formatShare(preview.precision, notAvailable),
			changed:
				formatShare(current.precision, notAvailable) !==
				formatShare(preview.precision, notAvailable)
		},
		{
			key: 'recall',
			label: tOverview('recallLabel'),
			from: formatShare(current.recall, notAvailable),
			to: formatShare(preview.recall, notAvailable),
			changed:
				formatShare(current.recall, notAvailable) !== formatShare(preview.recall, notAvailable)
		}
	]

	function setBoth(value: number) {
		const clamped = clampToStep(value)
		setDraft(clamped)
		setText(clamped.toFixed(2))
	}

	function commitText() {
		const value = Number(text)
		if (text.trim() !== '' && Number.isFinite(value)) setBoth(value)
		else setText(draft.toFixed(2))
	}

	return (
		<Popover
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open)
				if (open) setBoth(threshold)
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="secondary"
					size="sm"
					aria-label={t('thresholdEdit', { value: threshold.toFixed(2) })}
				>
					<SlidersIcon size={15} />
					{t('thresholdTrigger')}
					<span className="font-mono">{threshold.toFixed(2)}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[360px] p-0">
				<div className="px-4 pt-4 pb-3">
					<h3 className="type-subheading">{t('thresholdLabel')}</h3>
					<p className="text-text-muted mt-1 text-xs leading-relaxed">{t('thresholdHelp')}</p>
				</div>

				<div className="px-4">
					<div aria-hidden className="relative flex h-16 items-end gap-[3px]">
						{bins.map((bin) => (
							<div
								key={bin.from}
								className={cn(
									'flex-1 rounded-t-[3px]',
									bin.from >= draft ? 'bg-text' : 'bg-border-input'
								)}
								style={{
									height: `${Math.max(MIN_BAR_PERCENT, ((bin.matched + bin.notMatched) / tallest) * PERCENT)}%`
								}}
							/>
						))}
						<div
							className="bg-ring absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full"
							style={{ left: `${draft * PERCENT}%` }}
						/>
					</div>
					<div className="text-text-muted mt-1 flex justify-between font-mono text-[0.6875rem]">
						<span>0.0</span>
						<span>0.5</span>
						<span>1.0</span>
					</div>

					<div className="mt-3 flex items-center gap-3">
						<Slider
							min={0}
							max={1}
							step={STEP}
							value={[draft]}
							onValueChange={([value]) => {
								if (value != null) setBoth(value)
							}}
							thumbLabel={t('thresholdLabel')}
							className="flex-1"
						/>
						<Input
							aria-label={t('thresholdValue')}
							inputMode="decimal"
							className="h-8 w-[72px] text-center font-mono"
							value={text}
							onChange={(event) => setText(event.target.value)}
							onBlur={commitText}
							onKeyDown={(event) => {
								if (event.key === 'Enter') commitText()
							}}
						/>
					</div>
				</div>

				<div aria-live="polite" className="border-border mt-4 border-t px-4 py-3">
					<p className="text-text-muted mb-2 text-xs font-medium">
						{t('previewFor', { vendor: vendorName })}
					</p>
					<dl className="flex flex-col gap-1">
						{rows.map((row) => (
							<div key={row.key} className="type-ui flex items-center justify-between">
								<dt className="text-text flex items-center gap-2">
									{row.dot != null ? (
										<CategoryDot category={row.dot} />
									) : (
										<span className="w-2.5" />
									)}
									{row.label}
								</dt>
								<dd className="flex items-center gap-1.5 font-mono">
									<span className="text-text-muted">{row.from}</span>
									<ArrowRightIcon size={11} className="text-text-muted" />
									<span className="sr-only">{t('becomes')}</span>
									<span className={cn(row.changed ? 'text-accent-ink font-semibold' : 'text-text')}>
										{row.to}
									</span>
								</dd>
							</div>
						))}
					</dl>
				</div>

				<div className="border-border flex items-center justify-between gap-2 border-t px-4 py-3">
					<Button
						variant="quiet"
						size="sm"
						onClick={() => setBoth(threshold)}
						disabled={draft === threshold}
					>
						{t('resetTo', { value: threshold.toFixed(2) })}
					</Button>
					<Button variant="secondary" size="sm" asChild>
						<Link href={rulesHref}>
							{t('thresholdChangeInRules')}
							<ArrowRightIcon size={13} />
						</Link>
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}

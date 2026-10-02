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
import { histogram, vendorMetrics, type MetricPair } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'
import { CategoryDot } from './result-parts'
import { formatShare } from './results/overview/chart-theme'

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
	pairs
}: {
	threshold: number
	rulesHref: string
	vendorName: string
	pairs: MetricPair[]
}) {
	const t = useTranslations('Results')
	const tCat = useTranslations('Categories')
	const tOverview = useTranslations('Overview')
	const [isOpen, setIsOpen] = useState(false)
	const [draft, setDraft] = useState(threshold)
	const [text, setText] = useState(threshold.toFixed(2))
	const notAvailable = tOverview('notAvailable')

	const bins = histogram(pairs)
	const tallest = Math.max(1, ...bins.map((bin) => bin.matched + bin.notMatched))
	const current = vendorMetrics(pairs, threshold)
	const preview = vendorMetrics(pairs, draft)
	const rows: Array<{ key: string; label: string; dot?: Category; from: string; to: string }> = [
		{
			key: 'matches',
			label: t('pairsightMatches'),
			from: String(current.tp + current.fn),
			to: String(preview.tp + preview.fn)
		},
		...ORDER.map((category) => ({
			key: category,
			label: tCat(category),
			dot: category,
			from: String(current.counts[category]),
			to: String(preview.counts[category])
		})),
		{
			key: 'precision',
			label: tOverview('precisionLabel'),
			from: formatShare(current.precision, notAvailable),
			to: formatShare(preview.precision, notAvailable)
		},
		{
			key: 'recall',
			label: tOverview('recallLabel'),
			from: formatShare(current.recall, notAvailable),
			to: formatShare(preview.recall, notAvailable)
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
									<span
										className={cn(
											row.from !== row.to ? 'text-accent-ink font-semibold' : 'text-text'
										)}
									>
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

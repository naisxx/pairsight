'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ViewToggle, type ChartView } from '@/components/ui/view-toggle'
import {
	SENSITIVITY_STEP,
	type SensitivityPoint,
	type VendorMetrics
} from '@/lib/pairsight/metrics'
import {
	AXIS_TICK,
	CHART_ANIMATION_BEGIN_MS,
	CHART_ANIMATION_MS,
	formatShare,
	GRID_STROKE,
	MUTED_SERIES,
	SERIES_A,
	SERIES_B,
	THRESHOLD_STROKE
} from './chart-theme'
import { Count } from '@/components/ui/count'
import { cn } from '@/lib/cn'

const LINES = [
	{ key: 'precision', stroke: SERIES_A, dash: undefined },
	{ key: 'recall', stroke: SERIES_B, dash: undefined },
	{ key: 'f1', stroke: MUTED_SERIES, dash: '4 3' }
] as const

const PERCENT = 100
const X_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1]
const Y_TICKS = [0, 25, 50, 75, 100]
const MIN_SWEEP = 0.05
const MAX_SWEEP = 0.95

function nearest(points: SensitivityPoint[], threshold: number): SensitivityPoint | undefined {
	return points.reduce<SensitivityPoint | undefined>(
		(best, point) =>
			best == null || Math.abs(point.threshold - threshold) < Math.abs(best.threshold - threshold)
				? point
				: best,
		undefined
	)
}

function mono(chunks: React.ReactNode) {
	return <strong className="text-text font-mono font-semibold">{chunks}</strong>
}

// If the cut-off moved: how far it can go before the vendor's figures
// change, and what a step either way would do to the measure it trades
// against — from the scores Jev already gave, nothing re-run. Every cut-off,
// as a chart or a table, opens in a dialog.
export function ThresholdSensitivity({
	vendorName,
	threshold,
	metrics,
	points,
	stableRange,
	className
}: {
	vendorName: string
	threshold: number
	metrics: VendorMetrics
	points: SensitivityPoint[]
	stableRange: { from: number; to: number } | null
	className?: string
}) {
	const t = useTranslations('Overview')
	const [view, setView] = useState<ChartView>('chart')
	const [isOpen, setIsOpen] = useState(false)
	const notAvailable = t('notAvailable')
	const share = (value: number | null) => formatShare(value, notAvailable)
	// Recharts plots percentages; the table and tooltip format the same shares.
	const data = points.map((point) => ({
		...point,
		precisionPct: point.precision == null ? null : point.precision * PERCENT,
		recallPct: point.recall == null ? null : point.recall * PERCENT,
		f1Pct: point.f1 == null ? null : point.f1 * PERCENT
	}))
	const lower = nearest(points, Math.max(MIN_SWEEP, threshold - SENSITIVITY_STEP))
	const higher = nearest(points, Math.min(MAX_SWEEP, threshold + SENSITIVITY_STEP))

	return (
		<section
			id="sensitivity"
			aria-labelledby="sensitivity-title"
			className={cn('bg-surface border-border rounded-lg border p-6 md:p-7', className)}
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<h2 id="sensitivity-title" className="text-text-muted type-eyebrow">
					{t('cutoffMovedLabel')}
				</h2>
				<Button variant="quiet" size="sm" className="-mt-2 -mr-2" onClick={() => setIsOpen(true)}>
					{t('seeEveryCutoff')}
				</Button>
			</div>
			<p className="text-text-body mt-3 text-base">
				{stableRange == null
					? t('movesAny', { vendor: vendorName })
					: t.rich('holdsSteady', {
							vendor: vendorName,
							from: stableRange.from.toFixed(2),
							to: stableRange.to.toFixed(2),
							n: mono
						})}
			</p>
			<dl className="border-border mt-4 border-t">
				{lower != null && (
					<div className="border-border flex justify-between gap-3 border-b py-3">
						<dt>
							{t.rich('lowerToRich', {
								value: lower.threshold.toFixed(2),
								n: (chunks) => <span className="font-mono">{chunks}</span>
							})}
							<span className="text-text-muted block text-sm">{t('recallLabel')}</span>
						</dt>
						<dd className="font-mono font-semibold tracking-[-0.03em] whitespace-nowrap">
							{share(metrics.recall)} → {share(lower.recall)}
						</dd>
					</div>
				)}
				{higher != null && (
					<div className="flex justify-between gap-3 py-3">
						<dt>
							{t.rich('raiseToRich', {
								value: higher.threshold.toFixed(2),
								n: (chunks) => <span className="font-mono">{chunks}</span>
							})}
							<span className="text-text-muted block text-sm">{t('precisionLabel')}</span>
						</dt>
						<dd className="font-mono font-semibold tracking-[-0.03em] whitespace-nowrap">
							{share(metrics.precision)} → {share(higher.precision)}
						</dd>
					</div>
				)}
			</dl>
			<Dialog
				open={isOpen}
				onOpenChange={setIsOpen}
				title={t('sensitivityTitle')}
				description={t('sensitivityDescription', { vendor: vendorName })}
				closeLabel={t('close')}
				width="xl"
			>
				<div className="mb-3 flex justify-end">
					<ViewToggle
						view={view}
						onChange={setView}
						labels={{ showTable: t('showTable'), showChart: t('showChart') }}
					/>
				</div>
				<ul aria-hidden className="text-text-muted mb-2 flex flex-wrap gap-4 text-xs">
					{LINES.map((line) => (
						<li key={line.key} className="flex items-center gap-1.5">
							<svg width="14" height="4">
								<line
									x1="0"
									y1="2"
									x2="14"
									y2="2"
									stroke={line.stroke}
									strokeWidth="2"
									strokeDasharray={line.dash}
								/>
							</svg>
							{t(`${line.key}Label`)}
						</li>
					))}
					<li className="flex items-center gap-1.5">
						<span className="bg-ring h-3 w-[2px]" />
						{t('current')} <span className="text-text font-mono">{threshold.toFixed(2)}</span>
					</li>
				</ul>
				{view === 'chart' ? (
					<div
						role="img"
						aria-label={t('sensitivityChartLabel', {
							threshold: threshold.toFixed(2),
							precision: share(metrics.precision),
							recall: share(metrics.recall)
						})}
						className="h-[220px]"
					>
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -18 }}>
								<CartesianGrid vertical={false} stroke={GRID_STROKE} />
								<XAxis
									dataKey="threshold"
									type="number"
									domain={[0, 1]}
									ticks={X_TICKS}
									tickFormatter={(value: number) => value.toFixed(1)}
									tick={AXIS_TICK}
									axisLine={{ stroke: GRID_STROKE }}
									tickLine={false}
								/>
								<YAxis
									domain={[0, PERCENT]}
									ticks={Y_TICKS}
									tickFormatter={(value: number) => `${value}%`}
									tick={AXIS_TICK}
									axisLine={false}
									tickLine={false}
								/>
								<Tooltip
									cursor={{ stroke: 'var(--border-input)', strokeDasharray: '3 3' }}
									content={({ active, payload }) => {
										const point = payload?.[0]?.payload
										if (active !== true || point == null) return null
										return (
											<div className="border-border bg-surface-elevated shadow-elevated rounded-sm border px-3 py-2 text-xs">
												<p className="font-mono font-medium">
													{t('thresholdValue', { value: Number(point.threshold).toFixed(2) })}
												</p>
												{LINES.map((line) => (
													<p
														key={line.key}
														className="text-text-muted mt-0.5 flex items-center justify-between gap-4"
													>
														<span className="flex items-center gap-1.5">
															<span className="h-0.5 w-3" style={{ background: line.stroke }} />
															{t(`${line.key}Label`)}
														</span>
														<span className="text-text font-mono">
															{share(
																points.find(
																	(candidate) => candidate.threshold === point.threshold
																)?.[line.key] ?? null
															)}
														</span>
													</p>
												))}
												<p className="text-text-muted mt-1">
													{t.rich('sensitivityMatches', {
														count: Number(point.matches),
														n: (chunks) => <span className="text-text font-mono">{chunks}</span>
													})}
												</p>
											</div>
										)
									}}
								/>
								{LINES.map((line) => (
									<Line
										key={line.key}
										type="stepAfter"
										dataKey={`${line.key}Pct`}
										stroke={line.stroke}
										strokeWidth={2}
										strokeDasharray={line.dash}
										dot={false}
										activeDot={{ r: 3.5, strokeWidth: 0 }}
										connectNulls
										animationBegin={CHART_ANIMATION_BEGIN_MS}
										animationDuration={CHART_ANIMATION_MS}
										animationEasing="ease-out"
									/>
								))}
								<ReferenceLine
									x={threshold}
									stroke={THRESHOLD_STROKE}
									strokeWidth={2}
									strokeDasharray="4 3"
									label={{
										value: threshold.toFixed(2),
										position: 'top',
										fill: 'var(--accent-ink)',
										fontSize: 11,
										fontFamily: 'var(--font-mono)'
									}}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				) : (
					<div className="max-h-[240px] overflow-y-auto">
						<table className="type-ui w-full">
							<caption className="sr-only">{t('sensitivityCaption')}</caption>
							<thead className="bg-surface sticky top-0">
								<tr className="border-border text-text-muted border-b text-left text-xs">
									<th scope="col" className="py-1.5 font-medium">
										{t('thresholdLabel')}
									</th>
									{LINES.map((line) => (
										<th key={line.key} scope="col" className="py-1.5 text-right font-medium">
											{t(`${line.key}Label`)}
										</th>
									))}
									<th scope="col" className="py-1.5 text-right font-medium">
										{t('matchesLabel')}
									</th>
								</tr>
							</thead>
							<tbody className="font-mono">
								{points.map((point) => (
									<tr key={point.threshold} className="border-border border-b last:border-0">
										<th scope="row" className="py-1.5 text-left font-normal">
											{point.threshold.toFixed(2)}
										</th>
										<td className="py-1.5 text-right">{share(point.precision)}</td>
										<td className="py-1.5 text-right">{share(point.recall)}</td>
										<td className="py-1.5 text-right">{share(point.f1)}</td>
										<td className="py-1.5 text-right">
											<Count value={point.matches} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Dialog>
		</section>
	)
}

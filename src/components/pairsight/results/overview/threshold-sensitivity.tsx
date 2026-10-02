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
import { Panel } from '@/components/ui/panel'
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

// How the vendor's precision, recall and F1 move as PairSight's threshold
// changes, from saved scores only — and the nearby thresholds worth knowing.
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
		<Panel
			id="sensitivity"
			title={t('sensitivityTitle')}
			description={t('sensitivityDescription', { vendor: vendorName })}
			className={className}
			actions={
				<ViewToggle
					view={view}
					onChange={setView}
					labels={{ showTable: t('showTable'), showChart: t('showChart') }}
				/>
			}
		>
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
															points.find((candidate) => candidate.threshold === point.threshold)?.[
																line.key
															] ?? null
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
									<td className="py-1.5 text-right">{point.matches}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<dl className="border-border mt-3 grid gap-x-4 gap-y-2 border-t pt-3 text-xs @2xl:grid-cols-3">
				{lower != null && (
					<div>
						<dt className="text-text-muted">
							{t('lowerTo', { value: lower.threshold.toFixed(2) })}
						</dt>
						<dd className="mt-0.5">
							{t('recallLabel')} <span className="font-mono">{share(metrics.recall)}</span> →{' '}
							<span className="font-mono font-medium">{share(lower.recall)}</span>
						</dd>
					</div>
				)}
				{higher != null && (
					<div>
						<dt className="text-text-muted">
							{t('raiseTo', { value: higher.threshold.toFixed(2) })}
						</dt>
						<dd className="mt-0.5">
							{t('precisionLabel')} <span className="font-mono">{share(metrics.precision)}</span> →{' '}
							<span className="font-mono font-medium">{share(higher.precision)}</span>
						</dd>
					</div>
				)}
				<div>
					<dt className="text-text-muted">{t('stableRange')}</dt>
					<dd className="mt-0.5">
						{stableRange == null
							? t('sensitiveAround')
							: t.rich('stableFromTo', {
									from: stableRange.from.toFixed(2),
									to: stableRange.to.toFixed(2),
									n: (chunks) => <span className="font-mono">{chunks}</span>
								})}
					</dd>
				</div>
			</dl>
		</Panel>
	)
}

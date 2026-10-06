'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import {
	Bar,
	BarChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import { useRouter } from '@/i18n/routing'
import { Panel } from '@/components/ui/panel'
import { ViewToggle, type ChartView } from '@/components/ui/view-toggle'
import type { HistogramBin } from '@/lib/pairsight/metrics'
import {
	AXIS_TICK,
	CHART_ANIMATION_BEGIN_MS,
	CHART_ANIMATION_MS,
	GRID_STROKE,
	MATCHED_SERIES,
	UNMATCHED_SERIES,
	THRESHOLD_STROKE
} from './chart-theme'
import { Count } from '@/components/ui/count'

// Room for the last tick label ("1.0") so it isn't clipped.
const CHART_RIGHT_MARGIN = 16

const X_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1]
const HALF_BIN = 0.05

const rangeLabel = (bin: HistogramBin) => `${bin.from.toFixed(1)}–${bin.to.toFixed(1)}`

// How Jev scored the judged pairs, split by the vendor's decision, with the
// threshold as a line. A bar opens its score range in the detailed view.
export function ScoreDistribution({
	vendorName,
	threshold,
	assessed,
	bins,
	rangeHrefs,
	className
}: {
	vendorName: string
	threshold: number
	assessed: number
	bins: HistogramBin[]
	// One link per bin, in order: the detailed view filtered to its range.
	rangeHrefs: string[]
	className?: string
}) {
	const t = useTranslations('Overview')
	const format = useFormatter()
	const compact = (value: number) => format.number(value, 'compact')
	const router = useRouter()
	const [view, setView] = useState<ChartView>('chart')
	const data = bins.map((bin, index) => ({
		...bin,
		mid: bin.from + HALF_BIN,
		total: bin.matched + bin.notMatched,
		index
	}))
	const open = (index: number) => {
		const href = rangeHrefs[index]
		if (href != null) router.push(href)
	}

	return (
		<Panel
			id="histogram"
			title={t('histogramTitle')}
			description={t('histogramDescription', { assessed, vendor: vendorName })}
			className={className}
			actions={
				<ViewToggle
					view={view}
					onChange={setView}
					labels={{ showTable: t('showTable'), showChart: t('showChart') }}
				/>
			}
		>
			<ul aria-hidden className="text-text-muted mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				<li className="flex items-center gap-1.5">
					<span className="bg-text size-2.5 rounded-[3px]" />
					{t('matchedBy', { vendor: vendorName })}
				</li>
				<li className="flex items-center gap-1.5">
					<span className="bg-border-input size-2.5 rounded-[3px]" />
					{t('notMatched')}
				</li>
				<li className="flex items-center gap-1.5">
					<span className="bg-ring h-3 w-[2px]" />
					{t('thresholdLabel')} <span className="text-text font-mono">{threshold.toFixed(2)}</span>
				</li>
			</ul>
			{view === 'chart' ? (
				<div
					role="img"
					aria-label={t('histogramChartLabel', {
						summary: data.map((bin) => `${rangeLabel(bin)}: ${compact(bin.total)}`).join(', '),
						threshold: threshold.toFixed(2)
					})}
					className="h-[200px]"
				>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={data}
							margin={{ top: 18, right: CHART_RIGHT_MARGIN, bottom: 0, left: -20 }}
							barCategoryGap="14%"
						>
							<CartesianGrid vertical={false} stroke={GRID_STROKE} />
							<XAxis
								dataKey="mid"
								type="number"
								domain={[0, 1]}
								ticks={X_TICKS}
								tickFormatter={(value: number) => value.toFixed(1)}
								tick={AXIS_TICK}
								axisLine={{ stroke: GRID_STROKE }}
								tickLine={false}
							/>
							<YAxis
								allowDecimals={false}
								tickFormatter={compact}
								tick={AXIS_TICK}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								cursor={{ fill: 'var(--surface-hover)' }}
								content={({ active, payload }) => {
									const bin = data[Number(payload?.[0]?.payload?.index)]
									if (active !== true || bin == null) return null
									return (
										<div className="border-border bg-surface-elevated shadow-elevated rounded-sm border px-3 py-2 text-xs">
											<p className="font-mono font-medium">
												{t('scoreRange', { range: rangeLabel(bin) })}
											</p>
											<p className="text-text-muted mt-1">
												{t('matchedBy', { vendor: vendorName })}:{' '}
												<Count value={bin.matched} className="text-text font-mono" />
											</p>
											<p className="text-text-muted">
												{t('notMatched')}:{' '}
												<Count value={bin.notMatched} className="text-text font-mono" />
											</p>
											<p className="text-accent-ink mt-1">{t('clickToView')}</p>
										</div>
									)
								}}
							/>
							<Bar
								dataKey="notMatched"
								stackId="score"
								fill={UNMATCHED_SERIES}
								animationBegin={CHART_ANIMATION_BEGIN_MS}
								animationDuration={CHART_ANIMATION_MS}
								animationEasing="ease-out"
								cursor="pointer"
								onClick={(_, index) => open(index)}
							/>
							<Bar
								dataKey="matched"
								stackId="score"
								fill={MATCHED_SERIES}
								radius={[3, 3, 0, 0]}
								animationBegin={CHART_ANIMATION_BEGIN_MS}
								animationDuration={CHART_ANIMATION_MS}
								animationEasing="ease-out"
								cursor="pointer"
								onClick={(_, index) => open(index)}
							/>
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
						</BarChart>
					</ResponsiveContainer>
				</div>
			) : (
				<table className="type-ui w-full">
					<caption className="sr-only">{t('histogramTitle')}</caption>
					<thead>
						<tr className="border-border text-text-muted border-b text-left text-xs">
							<th scope="col" className="py-1.5 font-medium">
								{t('scoreLabel')}
							</th>
							<th scope="col" className="py-1.5 text-right font-medium">
								{t('matchedBy', { vendor: vendorName })}
							</th>
							<th scope="col" className="py-1.5 text-right font-medium">
								{t('notMatched')}
							</th>
							<th scope="col" className="py-1.5 text-right font-medium">
								{t('total')}
							</th>
						</tr>
					</thead>
					<tbody className="font-mono">
						{data.map((bin) => (
							<tr key={bin.index} className="border-border border-b last:border-0">
								<th scope="row" className="py-1.5 text-left font-normal">
									<button
										type="button"
										className="text-accent-ink hover:underline"
										onClick={() => open(bin.index)}
									>
										{rangeLabel(bin)}
									</button>
								</th>
								<td className="py-1.5 text-right">
									<Count value={bin.matched} />
								</td>
								<td className="py-1.5 text-right">
									<Count value={bin.notMatched} />
								</td>
								<td className="py-1.5 text-right">
									<Count value={bin.total} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</Panel>
	)
}

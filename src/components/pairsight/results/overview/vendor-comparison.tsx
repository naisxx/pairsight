'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	ResponsiveContainer,
	XAxis,
	YAxis
} from 'recharts'
import { useRouter } from '@/i18n/routing'
import { Panel } from '@/components/ui/panel'
import { ViewToggle, type ChartView } from '@/components/ui/view-toggle'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { cn } from '@/lib/cn'
import {
	AXIS_TICK,
	CHART_ANIMATION_MS,
	formatShare,
	GRID_STROKE,
	VENDOR_SERIES as SERIES
} from './chart-theme'

const METRICS = ['precision', 'recall', 'f1'] as const
const PERCENT = 100
const X_TICKS = [0, 25, 50, 75, 100]

type VendorRow = { id: string; name: string; metrics: VendorMetrics; href: string }

// Every vendor's precision, recall and F1 on the same pairs and scale, and
// the tradeoff between them in one sentence. Picking a vendor makes it the
// one the rest of the page describes.
export function VendorComparison({
	vendors,
	selectedId,
	className
}: {
	vendors: VendorRow[]
	selectedId: string
	className?: string
}) {
	const t = useTranslations('Overview')
	const router = useRouter()
	const [view, setView] = useState<ChartView>('chart')
	const notAvailable = t('notAvailable')
	const share = (value: number | null) => formatShare(value, notAvailable)

	const data = METRICS.map((metric) => {
		const row: Record<string, string | number | null> = { metric: t(`${metric}Label`) }
		for (const vendor of vendors) {
			const value = vendor.metrics[metric]
			row[vendor.id] = value == null ? 0 : value * PERCENT
			row[`${vendor.id}-raw`] = value
		}
		return row
	})

	const [first, second] = vendors
	let tradeoff: string | null = null
	if (
		first != null &&
		second != null &&
		first.metrics.precision != null &&
		second.metrics.precision != null &&
		first.metrics.recall != null &&
		second.metrics.recall != null
	) {
		const morePrecise = first.metrics.precision >= second.metrics.precision ? first : second
		const moreRecall = first.metrics.recall >= second.metrics.recall ? first : second
		tradeoff =
			morePrecise === moreRecall
				? t('tradeoffBoth', { vendor: morePrecise.name })
				: t('tradeoffSplit', { precise: morePrecise.name, recall: moreRecall.name })
	}

	return (
		<Panel
			id="vendors"
			title={t('comparisonTitle')}
			description={t('comparisonDescription')}
			className={className}
			actions={
				<ViewToggle
					view={view}
					onChange={setView}
					labels={{ showTable: t('showTable'), showChart: t('showChart') }}
				/>
			}
		>
			<ul aria-label={t('vendorsLabel')} className="mb-2 flex flex-wrap gap-2">
				{vendors.map((vendor, index) => (
					<li key={vendor.id}>
						<button
							type="button"
							onClick={() => router.push(vendor.href)}
							aria-pressed={vendor.id === selectedId}
							className={cn(
								'inline-flex h-7 items-center gap-2 rounded-sm border px-2.5 text-xs font-medium transition-[background-color,border-color] duration-150',
								vendor.id === selectedId
									? 'border-action bg-selected text-text'
									: 'border-border text-text-muted hover:bg-surface-hover hover:text-text'
							)}
						>
							<span
								aria-hidden
								className="size-2.5 rounded-[3px]"
								style={{ background: SERIES[index] }}
							/>
							{vendor.name}
						</button>
					</li>
				))}
			</ul>
			{view === 'chart' ? (
				<div
					role="img"
					aria-label={t('comparisonChartLabel', {
						summary: vendors
							.map((vendor) =>
								t('comparisonVendorSummary', {
									vendor: vendor.name,
									precision: share(vendor.metrics.precision),
									recall: share(vendor.metrics.recall),
									f1: share(vendor.metrics.f1)
								})
							)
							.join(' ')
					})}
					className="h-[200px]"
				>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={data}
							layout="vertical"
							margin={{ top: 4, right: 52, bottom: 0, left: 0 }}
							barCategoryGap="22%"
							barGap={3}
						>
							<CartesianGrid horizontal={false} stroke={GRID_STROKE} />
							<XAxis
								type="number"
								domain={[0, PERCENT]}
								ticks={X_TICKS}
								tickFormatter={(value: number) => `${value}%`}
								tick={AXIS_TICK}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								type="category"
								dataKey="metric"
								width={70}
								tick={{ fill: 'var(--text)', fontSize: 12 }}
								axisLine={false}
								tickLine={false}
							/>
							{vendors.map((vendor, index) => (
								<Bar
									key={vendor.id}
									dataKey={vendor.id}
									name={vendor.name}
									fill={SERIES[index]}
									radius={[0, 3, 3, 0]}
									animationDuration={CHART_ANIMATION_MS}
									animationEasing="ease-out"
									cursor="pointer"
									onClick={() => router.push(vendor.href)}
								>
									<LabelList
										dataKey={`${vendor.id}-raw`}
										position="right"
										formatter={(value) => share(typeof value === 'number' ? value : null)}
										style={{ fill: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
									/>
								</Bar>
							))}
						</BarChart>
					</ResponsiveContainer>
				</div>
			) : (
				<table className="type-ui w-full">
					<caption className="sr-only">{t('comparisonTitle')}</caption>
					<thead>
						<tr className="border-border text-text-muted border-b text-left text-xs">
							<th scope="col" className="py-2 font-medium">
								{t('vendorLabel')}
							</th>
							{METRICS.map((metric) => (
								<th key={metric} scope="col" className="py-2 text-right font-medium">
									{t(`${metric}Label`)}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="font-mono">
						{vendors.map((vendor) => (
							<tr key={vendor.id} className="border-border border-b last:border-0">
								<th scope="row" className="py-2 text-left font-sans font-normal">
									{vendor.name}
								</th>
								{METRICS.map((metric) => (
									<td key={metric} className="py-2 text-right">
										{share(vendor.metrics[metric])}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			)}
			{tradeoff != null && (
				<p className="text-text-muted mt-3 text-xs leading-relaxed">{tradeoff}</p>
			)}
		</Panel>
	)
}

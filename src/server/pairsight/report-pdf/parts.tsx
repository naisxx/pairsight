import { Line, Polyline, Rect, Svg, Text, View } from '@react-pdf/renderer'
import type { getTranslations } from 'next-intl/server'
import type { FailureReason } from '@/lib/pairsight/failure-reasons'
import type { SensitivityPoint } from '@/lib/pairsight/metrics'
import type { ReportExample, VendorDetail } from '../report-summary'
import { COLORS, styles, VENDOR_SERIES } from './styles'

// The report's building blocks. Words come in through ReportText, so the
// PDF stays translatable like every screen.

export type ReportText = {
	t: Awaited<ReturnType<typeof getTranslations>>
	role: (role: string) => string
	rule: (ruleId: string) => string
	failure: (reason: FailureReason) => string
	date: (date: Date) => string
	dateTime: (date: Date) => string
}

const PERCENT = 100
const SCORE_DIGITS = 2
const CHART_WIDTH = 515
const CHART_HEIGHT = 140
const CHART_TICKS = [0, 0.25, 0.5, 0.75, 1]
const LEGEND_SWATCH = 14

export function percent(value: number | null): string {
	return value == null ? '—' : `${Math.round(value * PERCENT)}%`
}

export function decimal(value: number | null): string {
	return value == null ? '—' : value.toFixed(SCORE_DIGITS)
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<View style={styles.keyValue} wrap={false}>
			<Text style={styles.key}>{label}</Text>
			<Text style={styles.value}>{children}</Text>
		</View>
	)
}

// `asScore`: shown as 0.86, like F1 everywhere else, rather than a percentage.
function MetricCell({
	value,
	width,
	asScore = false
}: {
	value: number | null
	width: string
	asScore?: boolean
}) {
	return (
		<View style={[styles.cell, { width }]}>
			<Text style={styles.number}>{asScore ? decimal(value) : percent(value)}</Text>
			<View style={styles.bar}>
				<View style={[styles.barFill, { width: `${Math.round((value ?? 0) * PERCENT)}%` }]} />
			</View>
		</View>
	)
}

const SCORECARD = {
	rank: '7%',
	vendor: '21%',
	count: '10.5%',
	metric: '10%'
} as const

// One row per vendor, best first: what it matched, what Jev made of that,
// and the three agreement metrics.
export function Scorecard({ vendors, text }: { vendors: VendorDetail[]; text: ReportText }) {
	const { t } = text
	const counts = (vendor: VendorDetail) => [
		vendor.metrics.tp + vendor.metrics.fp,
		vendor.metrics.tp,
		vendor.metrics.fp,
		vendor.metrics.fn
	]
	return (
		<View style={styles.table}>
			<View style={[styles.row, styles.headerRow]} fixed>
				<Text style={[styles.cell, { width: SCORECARD.rank }]}>{t('colRank')}</Text>
				<Text style={[styles.cell, { width: SCORECARD.vendor }]}>{t('colVendor')}</Text>
				{['colMatched', 'colAgreed', 'colMerges', 'colMisses'].map((key) => (
					<Text key={key} style={[styles.cell, styles.number, { width: SCORECARD.count }]}>
						{t(key)}
					</Text>
				))}
				{['colPrecision', 'colRecall', 'colF1'].map((key) => (
					<Text key={key} style={[styles.cell, styles.number, { width: SCORECARD.metric }]}>
						{t(key)}
					</Text>
				))}
			</View>
			{vendors.map((vendor) => (
				<View key={vendor.id} style={styles.row} wrap={false}>
					<Text style={[styles.cell, styles.bold, { width: SCORECARD.rank }]}>
						{vendor.rank ?? '—'}
					</Text>
					<Text style={[styles.cell, styles.bold, { width: SCORECARD.vendor }]}>{vendor.name}</Text>
					{counts(vendor).map((count, index) => (
						<Text key={index} style={[styles.cell, styles.number, { width: SCORECARD.count }]}>
							{count}
						</Text>
					))}
					<MetricCell value={vendor.metrics.precision} width={SCORECARD.metric} />
					<MetricCell value={vendor.metrics.recall} width={SCORECARD.metric} />
					<MetricCell value={vendor.metrics.f1} width={SCORECARD.metric} asScore />
				</View>
			))}
		</View>
	)
}

// The chart's runs of consecutive points with an F1, as polyline coordinates.
function segments(points: SensitivityPoint[]): string[] {
	const runs: string[][] = [[]]
	for (const point of points) {
		if (point.f1 == null) {
			runs.push([])
			continue
		}
		runs.at(-1)?.push(`${point.threshold * CHART_WIDTH},${(1 - point.f1) * CHART_HEIGHT}`)
	}
	return runs.filter((run) => run.length > 1).map((run) => run.join(' '))
}

// Each vendor's F1 at every threshold, the run's marked: whether the ranking
// holds wherever the line had been drawn.
export function SensitivityChart({
	vendors,
	threshold,
	text
}: {
	vendors: VendorDetail[]
	threshold: number
	text: ReportText
}) {
	return (
		<View wrap={false}>
			<Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
				<Rect x={0} y={0} width={CHART_WIDTH} height={CHART_HEIGHT} fill={COLORS.surfaceMuted} />
				{CHART_TICKS.map((tick) => (
					<Line
						key={tick}
						x1={0}
						x2={CHART_WIDTH}
						y1={(1 - tick) * CHART_HEIGHT}
						y2={(1 - tick) * CHART_HEIGHT}
						stroke={COLORS.border}
						strokeWidth={0.5}
					/>
				))}
				<Line
					x1={threshold * CHART_WIDTH}
					x2={threshold * CHART_WIDTH}
					y1={0}
					y2={CHART_HEIGHT}
					stroke={COLORS.action}
					strokeWidth={1}
					strokeDasharray="3 2"
				/>
				{vendors.map((vendor, index) =>
					segments(vendor.sensitivity).map((points, part) => (
						<Polyline
							key={`${vendor.id}-${part}`}
							points={points}
							fill="none"
							stroke={VENDOR_SERIES[index]?.color ?? COLORS.muted}
							strokeDasharray={VENDOR_SERIES[index]?.dash}
							strokeWidth={1.5}
						/>
					))
				)}
			</Svg>
			<View
				style={[
					styles.small,
					styles.muted,
					{ flexDirection: 'row', justifyContent: 'space-between' }
				]}
			>
				{CHART_TICKS.map((tick) => (
					<Text key={tick}>{tick.toFixed(SCORE_DIGITS)}</Text>
				))}
			</View>
			<View style={[styles.small, { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }]}>
				{vendors.map((vendor, index) => (
					<View
						key={vendor.id}
						style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}
					>
						<Svg width={LEGEND_SWATCH} height={4}>
							<Line
								x1={0}
								x2={LEGEND_SWATCH}
								y1={2}
								y2={2}
								stroke={VENDOR_SERIES[index]?.color ?? COLORS.muted}
								strokeDasharray={VENDOR_SERIES[index]?.dash}
								strokeWidth={1.5}
							/>
						</Svg>
						<Text style={{ marginLeft: 4 }}>{vendor.name}</Text>
					</View>
				))}
				<Text style={[styles.muted, { color: COLORS.action }]}>
					{text.t('chartThreshold', { threshold: decimal(threshold) })}
				</Text>
			</View>
		</View>
	)
}

const COMPARISON_COLOR = {
	same: COLORS.success,
	different: COLORS.danger,
	oneMissing: COLORS.muted,
	bothMissing: COLORS.muted
} as const

// One example pair: who's in it, Jev's score, how it was found, and each
// mapped field side by side. `heading`, for a section's first card, keeps the
// section title on the same page. The whole thing is one unbreakable block:
// react-pdf lays out an unbreakable block nested in another one wrongly.
export function ExampleCard({
	example,
	heading,
	text
}: {
	example: ReportExample
	heading?: string
	text: ReportText
}) {
	const { t } = text
	const source =
		example.ruleIds.length === 0
			? t('addedByVendor')
			: example.ruleIds.map((ruleId) => text.rule(ruleId)).join(', ')
	return (
		<View wrap={false}>
			{heading != null && <Text style={styles.h3}>{heading}</Text>}
			<View style={styles.card}>
				<Text style={styles.bold}>
					{example.recordA.reference} · {example.recordA.label}
					{` ${t('versus')} `}
					{example.recordB.reference} · {example.recordB.label}
				</Text>
				<Text style={[styles.small, styles.muted, { marginBottom: 4 }]}>
					{t('exampleMeta', { score: decimal(example.score), source })}
				</Text>
				{example.fields.map((field) => (
					<View key={field.role} style={styles.exampleRow}>
						<Text style={[styles.muted, { width: '18%' }]}>{text.role(field.role)}</Text>
						<Text style={{ width: '31%', paddingRight: 4 }}>{field.a || '—'}</Text>
						<Text style={{ width: '31%', paddingRight: 4 }}>{field.b || '—'}</Text>
						<Text style={{ width: '20%', color: COMPARISON_COLOR[field.comparison] }}>
							{field.isFormatOnly ? t('formatOnly') : t(field.comparison)}
						</Text>
					</View>
				))}
			</View>
		</View>
	)
}

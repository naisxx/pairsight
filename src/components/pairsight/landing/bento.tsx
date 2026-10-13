import { getFormatter, getTranslations } from 'next-intl/server'
import { EXACT_FORMATS } from '@/i18n/formats'
import { cn } from '@/lib/cn'
import type { LandingDemo } from '@/server/pairsight/landing-demo'
import { Eyebrow, LandingGlyph, SectionTitle, WRAP } from './parts'

const PERCENT = 100
// Each card rises in over the first 70% of its way into view.
export const REVEAL_RANGE = 'entry 0% entry 70%'
// The cut-off chart's drawing box (viewBox 0 0 300 110): the sweep runs
// from x 6 to 278, and the shares fill y 10 (highest) to 100 (lowest).
const CHART = { left: 6, right: 278, top: 10, bottom: 100, height: 110 }
// The keys the pair list and a pair answer to (results-keyboard.tsx,
// pair-keyboard.tsx).
const KEYS = ['↑', '↓', 'Enter', 'J', 'K', '/', 'Esc']
// What Jev never sees, each as a struck-out bar of its own length.
const HIDDEN = [
	{ key: 'blindVendorName', width: 96 },
	{ key: 'blindVendorDecision', width: 72 },
	{ key: 'blindRecordId', width: 84 }
] as const

const CARD =
	'bg-surface border-border relative flex min-h-[310px] min-w-0 flex-col overflow-clip rounded-[24px] border p-7'

function Card({
	title,
	body,
	className,
	children
}: {
	title: string
	body: string
	className?: string
	children: React.ReactNode
}) {
	return (
		<li data-range={REVEAL_RANGE} className={cn(CARD, 'landing-reveal landing-card', className)}>
			<h3 className="font-display text-[26px] leading-[1.1] font-semibold tracking-[-0.02em]">
				{title}
			</h3>
			<p className="text-text-body mt-2.5 max-w-[440px]">{body}</p>
			<div className="mt-auto pt-6">{children}</div>
		</li>
	)
}

// One measure across the sweep, as steps: flat between cut-offs, then a
// drop. `y` places a share in the drawing.
function stepPath(
	points: Array<{ threshold: number; value: number | null }>,
	x: (threshold: number) => number,
	y: (value: number) => number
): string {
	const drawn = points.flatMap((point) =>
		point.value == null ? [] : [{ x: x(point.threshold), y: y(point.value) }]
	)
	const [first, ...rest] = drawn
	if (first == null) return ''
	return [`M${first.x} ${first.y}`, ...rest.map((point) => `H${point.x}V${point.y}`)].join('')
}

// The cut-off card's picture: one vendor's correct merges (ink) and
// duplicates found (vermilion) across every cut-off, the stretch where they
// hold shaded, and the run's own cut-off dashed.
function CutoffChart({
	steady,
	threshold
}: {
	steady: NonNullable<LandingDemo['steady']>
	threshold: number
}) {
	const first = steady.points[0]?.threshold ?? 0
	const last = steady.points.at(-1)?.threshold ?? 1
	const x = (at: number) =>
		CHART.left + ((at - first) / (last - first || 1)) * (CHART.right - CHART.left)
	// Scaled to the shares drawn, so the shape shows even when both stay high.
	const values = steady.points.flatMap(({ precision, recall }) =>
		[precision, recall].filter((value) => value != null)
	)
	const low = Math.min(...values)
	const high = Math.max(...values)
	const y = (value: number) =>
		CHART.bottom - ((value - low) / (high - low || 1)) * (CHART.bottom - CHART.top)
	return (
		// The lines draw as the card comes in (the wrapper times its paths).
		<div
			data-range="entry 10% cover 45%"
			data-scroll-subtree
			className="max-w-[360px] flex-[1_1_260px]"
		>
			<svg
				viewBox={`0 0 300 ${CHART.height}`}
				aria-hidden
				className="h-auto w-full overflow-visible"
			>
				<rect
					x={x(steady.from)}
					y={4}
					width={x(steady.to) - x(steady.from)}
					height={96}
					className="fill-border"
					opacity={0.7}
				/>
				<path
					d={stepPath(
						steady.points.map((point) => ({ threshold: point.threshold, value: point.precision })),
						x,
						y
					)}
					fill="none"
					pathLength={1}
					className="landing-draw stroke-text"
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
				<path
					d={stepPath(
						steady.points.map((point) => ({ threshold: point.threshold, value: point.recall })),
						x,
						y
					)}
					fill="none"
					pathLength={1}
					className="landing-draw stroke-brand"
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
				<path
					d={`M${x(threshold)} 0V104`}
					fill="none"
					className="stroke-text-muted"
					strokeWidth={1.5}
					strokeDasharray="3 4"
				/>
			</svg>
		</div>
	)
}

// What you get (pairsight-handoff Landing, the bento): the cut-off preview,
// what Jev never sees, the kept run, the keys and the downloads, each with
// the demo's own figures.
export async function Bento({ demo }: { demo: LandingDemo }) {
	const [t, tRoles, format] = await Promise.all([
		getTranslations('HomePage'),
		getTranslations('Roles'),
		getFormatter()
	])
	const { steady, threshold, run } = demo
	const share = (value: number) => `${value * PERCENT}%`

	return (
		<section
			id="after"
			aria-labelledby="after-title"
			className="bg-surface-muted/74 relative py-[136px] max-[599px]:hidden"
		>
			<div className={WRAP}>
				<Eyebrow glyph="same">{t('afterEyebrow')}</Eyebrow>
				<SectionTitle id="after-title" lead={t('afterTitle')} accent={t('afterTitleAccent')} />
				<ul className="mt-[72px] grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
					<Card title={t('cutoffTitle')} body={t('cutoffBody')} className="min-[900px]:col-span-2">
						{steady != null && (
							<div className="flex flex-wrap items-end gap-x-10 gap-y-6">
								<div className="flex-[1_1_240px]">
									<p className="font-mono text-[15px]">
										{t.rich('cutoffSteady', {
											vendor: steady.vendor,
											from: steady.from.toFixed(2),
											to: steady.to.toFixed(2),
											n: (chunks) => <strong>{chunks}</strong>
										})}
									</p>
									<div aria-hidden className="bg-border relative mt-[26px] h-2 rounded-[4px]">
										<span
											className="bg-ice absolute inset-y-0 rounded-[4px]"
											style={{ left: share(steady.from), width: share(steady.to - steady.from) }}
										/>
										{/* The cut-off; with motion it sways across the steady stretch. */}
										<span
											className="landing-knob bg-brand absolute -top-[9px] -ml-[3px] h-[26px] w-1.5 rounded-[3px]"
											style={{
												left: share(threshold),
												'--from': share(steady.from),
												'--to': share(steady.to)
											}}
										/>
									</div>
									<p
										aria-hidden
										className="text-text-muted mt-2.5 flex justify-between font-mono text-sm"
									>
										<span>0</span>
										<span>{threshold.toFixed(2)}</span>
										<span>1</span>
									</p>
								</div>
								<CutoffChart steady={steady} threshold={threshold} />
							</div>
						)}
					</Card>

					<Card title={t('blindCardTitle')} body={t('blindCardBody')}>
						<ul className="text-sm">
							{(['product_name', 'gtin'] as const).map((role) => (
								<li
									key={role}
									className="border-border flex items-center justify-between gap-3 border-t py-[9px]"
								>
									{tRoles(role)}
									<LandingGlyph kind="same" />
								</li>
							))}
							{HIDDEN.map(({ key, width }) => (
								<li
									key={key}
									className="border-border text-text-muted flex items-center justify-between gap-3 border-t py-[9px]"
								>
									{t(key)}
									<span className="sr-only">{t('blindHidden')}</span>
									<i aria-hidden className="landing-masked h-2.5 rounded-[5px]" style={{ width }} />
								</li>
							))}
						</ul>
					</Card>

					<Card title={t('runTitle')} body={t('runBody')}>
						<div className="relative h-[104px] font-mono text-[0.8125rem]">
							<div
								aria-hidden
								className="landing-run-back-2 bg-surface-muted border-border absolute inset-x-0 top-5 h-[66px] rounded-[14px] border opacity-35"
							/>
							<div
								aria-hidden
								className="landing-run-back-1 bg-surface-muted border-border absolute inset-x-0 top-2.5 h-[66px] rounded-[14px] border opacity-60"
							/>
							<p className="bg-surface border-border absolute inset-x-0 top-0 rounded-[14px] border px-4 py-3">
								{t.rich('runLine', {
									number: run.number,
									date: format.dateTime(run.createdAt, { dateStyle: 'medium' }),
									b: (chunks) => <strong>{chunks}</strong>
								})}{' '}
								<br />
								<span className="text-text-muted">
									{t(
										'runDetail',
										{ model: run.model, threshold: threshold.toFixed(2), count: demo.checked },
										EXACT_FORMATS
									)}
								</span>
							</p>
						</div>
					</Card>

					<Card title={t('keysTitle')} body={t('keysBody', { count: demo.checked }, EXACT_FORMATS)}>
						<ul aria-label={t('keysLabel')} className="flex flex-wrap gap-2">
							{KEYS.map((key) => (
								<li key={key}>
									<kbd className="landing-key bg-surface-muted border-border inline-flex h-11 min-w-11 items-center justify-center rounded-[10px] border border-b-[3px] px-3 font-mono text-sm">
										{key}
									</kbd>
								</li>
							))}
						</ul>
					</Card>

					<Card title={t('downloadTitle')} body={t('downloadBody')}>
						<ul aria-label={t('downloadsLabel')} className="flex flex-wrap gap-2">
							{(['downloadCsv', 'downloadExcel', 'downloadPdf'] as const).map((key) => (
								<li
									key={key}
									className="landing-tag bg-surface border-border inline-flex min-h-10 items-center rounded-[8px] border px-3.5 font-mono text-[0.8125rem]"
								>
									{t(key)}
								</li>
							))}
						</ul>
					</Card>
				</ul>
			</div>
		</section>
	)
}

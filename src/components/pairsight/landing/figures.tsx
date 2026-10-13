import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Count } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'
import { cn } from '@/lib/cn'
import type { Category } from '@/lib/pairsight/decisions'
import type { LandingDemo } from '@/server/pairsight/landing-demo'
import { formatShare } from '../results/overview/chart-theme'
import { REVEAL_RANGE } from './bento'
import { DISPLAY, WRAP } from './parts'

const PERCENT = 100
// The bar's groups in the design's order, with their fills: agreement in
// ink, then Jev's lone calls, the vendor's lone merges, and the ground.
const SPLIT: Array<{ category: Category; className: string }> = [
	{ category: 'both_matched', className: 'bg-inverse text-on-inverse' },
	{ category: 'pairsight_only', className: 'bg-ice text-action-ink' },
	{ category: 'vendor_only', className: 'bg-brand text-action-ink' },
	{ category: 'neither_matched', className: 'bg-border text-text-body' }
]
const EXAMPLES_PER_FIGURE = 3
const FIGURE_LINE =
	'border-border text-text-body flex justify-between gap-3 border-t py-[9px] font-mono text-[0.8125rem]'

function Figure({
	href,
	label,
	value,
	from,
	children
}: {
	href: string
	label: string
	value: React.ReactNode
	from: string
	children: React.ReactNode
}) {
	return (
		<Link
			href={href}
			data-range={REVEAL_RANGE}
			className="landing-figure landing-reveal landing-press border-text block min-w-0 flex-[1_1_250px] border-t-2 pt-7"
		>
			<span className="mb-3.5 block font-semibold">{label}</span>
			<b className="landing-figure-value block font-mono text-[56px] leading-[60px] font-semibold tracking-[-0.04em]">
				{value}
			</b>
			<span className="text-text-muted mt-3 block text-sm">{from}</span>
			{/* Some of its pairs, on hover or focus. They repeat what's one click
			    away, so a screen reader hears the figure alone. */}
			<span aria-hidden className="landing-figure-pairs">
				<span className="block overflow-hidden">
					<span className="block pt-3.5">{children}</span>
				</span>
			</span>
		</Link>
	)
}

// Every figure opens into the pairs behind it (pairsight-handoff Landing):
// each vendor's pairs split by who says same, then the leading vendor's four
// figures, each a link to those pairs in the demo.
export async function Figures({ demo }: { demo: LandingDemo }) {
	const [t, tCategories] = await Promise.all([
		getTranslations('HomePage'),
		getTranslations('Categories')
	])
	const leader = demo.vendors[0]
	if (leader == null) return null
	const overview = `${demo.resultsHref}?vendor=${leader.id}`
	const examples = (index: number) =>
		demo.agreedExamples
			.slice(index * EXAMPLES_PER_FIGURE, (index + 1) * EXAMPLES_PER_FIGURE)
			.map((pair) => (
				<span key={pair.key} className={FIGURE_LINE}>
					{pair.name}
					<strong>{pair.score.toFixed(2)}</strong>
				</span>
			))
	const { counts } = leader

	return (
		<section
			aria-labelledby="figures-title"
			className="bg-surface-muted/74 relative py-[136px] max-[599px]:hidden"
		>
			<div className={WRAP}>
				<div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-6">
					<h2
						id="figures-title"
						className={cn('flex-[1_1_560px] text-[clamp(40px,4.6vw,68px)]', DISPLAY)}
					>
						{t('figuresTitle')} <br />
						<span className="text-text-muted">{t('figuresTitleAccent')}</span>
					</h2>
					<p className="text-text-body flex-[0_1_360px]">{t('figuresBody')}</p>
				</div>

				<div className="mt-16 flex flex-col gap-[22px]">
					{demo.vendors.map((vendor) => (
						<div key={vendor.id}>
							<div className="mb-2 flex items-baseline justify-between">
								<strong>{vendor.name}</strong>
								<span className="text-text-muted font-mono text-sm">
									{t('figuresPairs', { count: vendor.checked }, EXACT_FORMATS)}
								</span>
							</div>
							<div
								role="img"
								aria-label={t(
									'figuresSplit',
									{
										vendor: vendor.name,
										both: vendor.counts.both_matched,
										jev: vendor.counts.pairsight_only,
										vendorOnly: vendor.counts.vendor_only,
										neither: vendor.counts.neither_matched
									},
									EXACT_FORMATS
								)}
								data-range="entry 0% cover 35%"
								className="landing-grow flex h-11 gap-0.5 overflow-hidden rounded-[12px]"
							>
								{SPLIT.map(({ category, className }) => (
									<span
										key={category}
										className={cn(
											'flex min-w-0 items-center justify-center font-mono text-[0.8125rem] font-semibold',
											className
										)}
										style={{
											width: `${(vendor.counts[category] / (vendor.checked || 1)) * PERCENT}%`
										}}
									>
										<Count value={vendor.counts[category]} />
									</span>
								))}
							</div>
						</div>
					))}
					<ul className="text-text-body flex flex-wrap gap-x-6 gap-y-2 text-sm">
						{SPLIT.map(({ category, className }) => (
							<li key={category} className="flex items-center gap-2">
								<span aria-hidden className={cn('size-3 rounded-[3px]', className)} />
								{tCategories(category)}
							</li>
						))}
					</ul>
				</div>

				<div className="mt-[72px] flex flex-wrap items-start gap-x-8 gap-y-6">
					<Figure
						href={overview}
						label={t('figOverall')}
						value={formatShare(leader.f1, '—')}
						from={t('figOverallFrom', { count: leader.checked }, EXACT_FORMATS)}
					>
						{examples(0)}
					</Figure>
					<Figure
						href={overview}
						label={t('figPrecision')}
						value={formatShare(leader.precision, '—')}
						from={t(
							'figPrecisionFrom',
							{ count: counts.both_matched + counts.vendor_only },
							EXACT_FORMATS
						)}
					>
						{examples(1)}
					</Figure>
					<Figure
						href={overview}
						label={t('figRecall')}
						value={formatShare(leader.recall, '—')}
						from={t(
							'figRecallFrom',
							{ count: counts.both_matched + counts.pairsight_only },
							EXACT_FORMATS
						)}
					>
						{examples(2)}
					</Figure>
					<Figure
						href={`${overview}&tab=detailed&category=disagreements`}
						label={t('figDisagreements')}
						value={<Count value={counts.vendor_only + counts.pairsight_only} />}
						from={t('figDisagreementsFrom')}
					>
						{(['vendor_only', 'pairsight_only'] as const).map((category) => (
							<span key={category} className={FIGURE_LINE}>
								{tCategories(category)}
								<strong>
									<Count value={counts[category]} />
								</strong>
							</span>
						))}
					</Figure>
				</div>
				<p className="text-text-muted mt-7 text-sm">{t('figuresNote', { vendor: leader.name })}</p>
			</div>
		</section>
	)
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatedPercent } from '@/components/ui/animated-number'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'
import { CATEGORIES, MAX_THRESHOLD, MIN_THRESHOLD, categorize } from '@/lib/pairsight/decisions'
import { vendorMetrics } from '@/lib/pairsight/metrics'
import type { LandingDemo, LandingPair } from '@/server/pairsight/landing-demo'
import { DiffText } from '../pair/field-compare-table'
import { CategoryBadge, CategoryDot, ScoreBar } from '../result-parts'
import { STORY_PAIR } from './sections'

const CUTOFF_STEP = 0.01
const LIST_BAR_WIDTH = 44

// The hero's results panel: the demo's real run, live. Pick a vendor, move the
// match cut-off, and the scores, the four counts and every pair's label
// recompute with the same functions the Results screen uses. Click a pair to
// see what differs and what Jev and the vendor said.
export function HeroResults({ demo }: { demo: LandingDemo }) {
	const t = useTranslations('HomePage')
	const tCategories = useTranslations('Categories')
	const [vendorIndex, setVendorIndex] = useState(0)
	const [threshold, setThreshold] = useState(demo.threshold)
	const [openKey, setOpenKey] = useState<string>(STORY_PAIR)

	const isMatchedBy = (pair: LandingPair) => pair.matchedBy.includes(vendorIndex)
	const metrics = vendorMetrics(
		demo.pairs.map((pair) => ({
			status: 'succeeded',
			score: pair.score,
			isVendorMatch: isMatchedBy(pair)
		})),
		threshold
	)
	const categoryOf = (pair: LandingPair) =>
		categorize({
			status: 'succeeded',
			score: pair.score,
			isVendorMatch: isMatchedBy(pair),
			threshold
		})
	const openPair = demo.pairs.find((pair) => pair.key === openKey) ?? demo.pairs[0]
	const vendorName = demo.vendors[vendorIndex]?.name ?? ''

	return (
		<section
			aria-label={t('panelLabel')}
			className="border-border bg-surface rounded-lg border shadow-[0_24px_60px_-24px_rgb(15_23_32/0.28)]"
		>
			<header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
				<div className="min-w-0">
					<p className="type-ui truncate font-semibold">{demo.name}</p>
					<p className="text-text-muted text-xs">
						{t('panelMeta', { records: demo.recordCount, pairs: demo.pairs.length })}
					</p>
				</div>
				<Segmented
					label={t('panelVendor')}
					value={String(vendorIndex)}
					onChange={(value) => setVendorIndex(Number(value))}
					options={demo.vendors.map((vendor, index) => ({
						value: String(index),
						label: vendor.name
					}))}
				/>
			</header>

			<dl className="border-border grid border-b sm:grid-cols-3">
				{(
					[
						['metricPrecision', metrics.precision],
						['metricRecall', metrics.recall],
						['metricF1', metrics.f1]
					] as const
				).map(([label, value]) => (
					<div
						key={label}
						className="border-border flex items-baseline justify-between gap-3 px-4 py-2 not-last:border-b sm:block sm:py-3 sm:not-last:border-r sm:not-last:border-b-0"
					>
						<dt className="text-text-muted text-xs whitespace-nowrap">{t(label)}</dt>
						<dd className="font-mono text-lg font-semibold tracking-[-0.01em] sm:mt-0.5 sm:text-xl">
							<AnimatedPercent value={value} emptyLabel={t('metricEmpty')} />
						</dd>
					</div>
				))}
			</dl>

			<div className="border-border flex items-center gap-4 border-b px-4 py-3">
				<label htmlFor="hero-cutoff" className="type-ui shrink-0 font-medium">
					{t('panelCutoff')}
				</label>
				<Slider
					id="hero-cutoff"
					thumbLabel={t('panelCutoff')}
					min={MIN_THRESHOLD}
					max={MAX_THRESHOLD}
					step={CUTOFF_STEP}
					value={[threshold]}
					onValueChange={([value]) => {
						if (value != null) setThreshold(value)
					}}
				/>
				<output htmlFor="hero-cutoff" className="type-ui w-9 shrink-0 text-right font-mono">
					{threshold.toFixed(2)}
				</output>
			</div>

			<ul
				aria-label={t('panelCounts', { vendor: vendorName })}
				className="border-border bg-border grid grid-cols-2 gap-px border-b"
			>
				{CATEGORIES.map((category) => (
					<li
						key={category}
						className="bg-surface px-3 py-2 sm:flex sm:items-center sm:justify-between sm:gap-2 sm:px-4"
					>
						<span className="text-text-muted flex items-center gap-1.5 text-xs whitespace-nowrap">
							<CategoryDot category={category} />
							{tCategories(category)}
						</span>
						<span className="font-mono font-semibold" data-testid={`count-${category}`}>
							{metrics.counts[category]}
						</span>
					</li>
				))}
			</ul>

			<div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
				<ul
					aria-label={t('panelPairs')}
					className="border-border max-h-[300px] overflow-y-auto p-2 md:max-h-[340px] md:border-r"
				>
					{demo.pairs.map((pair) => {
						const category = categoryOf(pair)
						const isOpen = pair.key === openPair?.key
						return (
							<li key={pair.key}>
								<button
									type="button"
									aria-pressed={isOpen}
									aria-controls="hero-pair"
									onClick={() => setOpenKey(pair.key)}
									className={cn(
										'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150',
										isOpen ? 'bg-surface-muted' : 'hover:bg-surface-hover'
									)}
								>
									{category !== 'incomplete' && <CategoryDot category={category} />}
									<span className="type-ui min-w-0 flex-1">
										<span className="block truncate">{pair.names[0]}</span>
										<span className="text-text-muted block truncate">{pair.names[1]}</span>
									</span>
									<ScoreBar score={pair.score} threshold={threshold} width={LIST_BAR_WIDTH} />
								</button>
							</li>
						)
					})}
				</ul>
				{openPair != null && (
					<PairDetail
						pair={openPair}
						threshold={threshold}
						vendorName={vendorName}
						isVendorMatch={isMatchedBy(openPair)}
						category={categoryOf(openPair)}
					/>
				)}
			</div>
		</section>
	)
}

function PairDetail({
	pair,
	threshold,
	vendorName,
	isVendorMatch,
	category
}: {
	pair: LandingPair
	threshold: number
	vendorName: string
	isVendorMatch: boolean
	category: ReturnType<typeof categorize>
}) {
	const t = useTranslations('HomePage')
	const tRoles = useTranslations('Roles')
	return (
		<div
			id="hero-pair"
			aria-live="polite"
			className="border-border space-y-3 border-t p-4 md:border-t-0"
		>
			<div className="flex items-center justify-between gap-2">
				<p className="type-ui font-mono font-medium">
					{pair.refs[0]} · {pair.refs[1]}
				</p>
				<CategoryBadge category={category} />
			</div>
			<dl className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
				{pair.fields.map((field) => (
					<div key={field.role} className="contents">
						<dt className="text-text-muted whitespace-nowrap">{tRoles(field.role)}</dt>
						{field.comparison === 'different' ? (
							<>
								<dd className="[overflow-wrap:anywhere]">
									<DiffText value={field.a} other={field.b} />
								</dd>
								<dd className="[overflow-wrap:anywhere]">
									<DiffText value={field.b} other={field.a} />
								</dd>
							</>
						) : (
							<>
								<dd className={cn('[overflow-wrap:anywhere]', field.a === '' && 'text-text-muted')}>
									{field.a === '' ? t('panelEmpty') : field.a}
								</dd>
								<dd className={cn('[overflow-wrap:anywhere]', field.b === '' && 'text-text-muted')}>
									{field.b === '' ? t('panelEmpty') : field.b}
								</dd>
							</>
						)}
					</div>
				))}
			</dl>
			<div className="border-border space-y-2 border-t pt-3">
				<p className="text-text-muted text-xs">{t('panelJevScore')}</p>
				<ScoreBar score={pair.score} threshold={threshold} size="lg" />
				<p className="type-ui">
					{t('panelVendorSaid', { vendor: vendorName, matched: String(isVendorMatch) })}
				</p>
			</div>
		</div>
	)
}

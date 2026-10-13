'use client'

import { useDeferredValue } from 'react'
import { EXACT_FORMATS } from '@/i18n/formats'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { AnimatedPercent } from '@/components/ui/animated-number'
import { Chip } from '@/components/ui/chip'
import { Count } from '@/components/ui/count'
import { WarningCircleIcon } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import type { Category } from '@/lib/pairsight/decisions'
import { agreedCount } from '@/lib/pairsight/agreement'
import { mosaicOf } from '@/lib/pairsight/mosaic'
import { leadingVendorId, rankVendors } from '@/lib/pairsight/ranking'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { statsMetricsAt, type StatsRow } from '@/lib/pairsight/stats'
import { useCutoffPreview } from '../cutoff-preview'
import { PreviewNote } from '../preview-note'
import { cn } from '@/lib/cn'
import { Mosaic, MOSAIC_TILE } from '../../mosaic'
import { VendorSwatch } from '../../vendor-swatch'

// The legend's order: who says same, from both to neither.
const ORDER: Category[] = ['both_matched', 'vendor_only', 'pairsight_only', 'neither_matched']
type Vendor = { id: string; name: string; metrics: VendorMetrics }
type CategoryLink = Category | 'incomplete'

function LegendItem({
	category,
	href,
	label,
	count,
	swatch,
	text
}: {
	category: CategoryLink
	href: string
	// The link's name: the category, its count, and that it opens them.
	label: string
	count: number
	swatch: string
	text: string
}) {
	return (
		<li>
			<Link
				href={href}
				aria-label={label}
				data-legend={category}
				className="group text-text-body hover:text-text decoration-border-strong inline-flex items-center gap-2 text-sm underline-offset-[3px] transition-[color] duration-150 hover:underline pointer-coarse:min-h-11"
			>
				<span
					aria-hidden
					className={cn(
						'size-3 shrink-0 rounded-[3px] transition-[scale] duration-150 ease-out motion-safe:group-hover:scale-125',
						swatch
					)}
				/>
				<span>
					<Count value={count} className="font-mono" /> {text}
				</span>
			</Link>
		</li>
	)
}

function VendorCard({
	vendor,
	colourIndex,
	isSelected,
	isClosest,
	runThreshold,
	isOnly,
	href,
	categoryHrefs
}: {
	vendor: Vendor
	colourIndex: number
	isSelected: boolean
	isClosest: boolean
	// The run's own cut-off: what its lists open at, even mid-preview.
	runThreshold: number
	isOnly: boolean
	href: string
	categoryHrefs: Partial<Record<CategoryLink, string>>
}) {
	const t = useTranslations('Overview')
	const tCat = useTranslations('Categories')
	const router = useRouter()
	const { metrics } = vendor
	const incomplete = metrics.counts.incomplete
	const mosaic = mosaicOf(metrics.counts)
	const nameClass =
		'text-text font-display flex min-w-0 items-center gap-2.5 text-2xl leading-tight font-semibold tracking-[-0.025em]'

	return (
		<article
			className={cn(
				'mosaic-card bg-surface relative flex h-full flex-col rounded-lg border p-6 transition-[border-color,translate] duration-200 ease-out md:p-7',
				isSelected && !isOnly ? 'border-text-muted' : 'border-border',
				// Lifts under the pointer and settles back when pressed.
				!isOnly &&
					'hover:border-border-strong motion-safe:hover:-translate-y-1 motion-safe:active:translate-y-0 motion-safe:active:duration-75'
			)}
		>
			<header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<h3 className={nameClass}>
					<VendorSwatch index={colourIndex} className="size-3" />
					{isOnly ? (
						<span className="truncate">{vendor.name}</span>
					) : (
						// The whole card picks the vendor; the legend's links sit above it.
						<Link
							href={href}
							aria-current={isSelected ? 'true' : undefined}
							className="truncate after:absolute after:inset-0 after:rounded-lg"
						>
							{vendor.name}
						</Link>
					)}
				</h3>
				{/* The overall score leads: it's what ranks the vendors (ranking.ts). */}
				<span className="flex items-baseline gap-1.5">
					<AnimatedPercent
						value={metrics.f1}
						emptyLabel={t('notAvailable')}
						className="text-text font-mono text-[2.5rem] leading-none font-semibold tracking-[-0.03em]"
					/>
					<span className="text-text-muted relative z-[1] flex items-center gap-1 text-sm">
						{t('overallShort')}
						<InfoTip
							label={t('whatIs', { metric: t('f1Label') })}
							content={t('f1Tip', { vendor: vendor.name })}
						/>
					</span>
				</span>
			</header>
			{/* Pinned on the card's top edge, so a card with a badge keeps its
			    mosaic level with the cards beside it. */}
			{(isClosest || incomplete > 0) && (
				<div className="absolute -top-3.5 left-6 flex flex-wrap gap-2 md:left-7">
					{isClosest && <Chip tone="brand">{t('bestOverall')}</Chip>}
					{incomplete > 0 && (
						// A solid backing: the tinted chip sits across the card's edge.
						<span className="bg-surface rounded-sm">
							<Chip tone="warning" icon={<WarningCircleIcon size={13} />}>
								{t('provisional')}
							</Chip>
						</span>
					)}
				</div>
			)}

			{/* Above the card's link, so its tiles pop under the pointer; a click
			    on it still picks the vendor (keyboard users have the name link). */}
			<div
				className={cn('relative z-[1] mt-5', !isOnly && 'cursor-pointer')}
				onClick={isOnly ? undefined : () => router.push(href)}
			>
				<Mosaic
					mosaic={mosaic}
					label={
						mosaic.perTile === 1
							? t('mosaicLabel', { tiles: mosaic.tiles.length, vendor: vendor.name })
							: t('mosaicLabelBucketed', {
									tiles: mosaic.tiles.length,
									perTile: mosaic.perTile,
									vendor: vendor.name
								})
					}
					pop
				/>
			</div>

			<section
				aria-label={
					isSelected ? t('categoriesLabel') : t('categoriesLabelFor', { vendor: vendor.name })
				}
				className="relative z-[1] mt-4"
			>
				<ul className="flex flex-wrap gap-x-[18px] gap-y-1.5">
					{ORDER.map((category) => (
						<LegendItem
							key={category}
							category={category}
							href={categoryHrefs[category] ?? ''}
							label={t('categoryTileLabel', {
								category: tCat(category),
								count: metrics.counts[category]
							})}
							count={metrics.counts[category]}
							swatch={MOSAIC_TILE[category]}
							text={t(`legend.${category}`)}
						/>
					))}
					{incomplete > 0 && (
						<LegendItem
							category="incomplete"
							href={categoryHrefs.incomplete ?? ''}
							label={t('categoryTileLabel', { category: tCat('incomplete'), count: incomplete })}
							count={incomplete}
							swatch="border-text-muted border border-dashed"
							text={t('legend.incomplete')}
						/>
					)}
				</ul>
				{mosaic.perTile > 1 && (
					<p className="text-text-muted mt-2 text-sm">
						{t('mosaicPerTile', { perTile: mosaic.perTile })}
					</p>
				)}
				<PreviewNote runThreshold={runThreshold} message="lists" className="mt-2" />
			</section>
		</article>
	)
}

function MeasureLabel({ label, hint, tip }: { label: string; hint: string; tip?: string }) {
	const t = useTranslations('Overview')
	return (
		<>
			<span className="text-text flex items-center gap-1 text-base font-semibold">
				{label}
				{tip != null && <InfoTip label={t('whatIs', { metric: label })} content={tip} />}
			</span>
			<span className="text-text-muted block text-sm">{hint}</span>
		</>
	)
}

function HigherChip() {
	const t = useTranslations('Overview')
	return (
		<Chip className="ml-2 min-h-[22px] px-1.5 align-middle text-[0.6875rem] tracking-normal">
			{t('higher')}
		</Chip>
	)
}

// The vendor with the strictly highest value, if there's one; null on a tie
// or with a single vendor.
function highestId(vendors: Vendor[], value: (vendor: Vendor) => number | null): string | null {
	if (vendors.length < 2) return null
	const scored = vendors.flatMap((vendor) => {
		const v = value(vendor)
		return v == null ? [] : [{ id: vendor.id, v }]
	})
	const best = Math.max(...scored.map((entry) => entry.v))
	const top = scored.filter((entry) => entry.v === best)
	return top.length === 1 ? (top[0]?.id ?? null) : null
}

type MeasureRow = {
	key: string
	label: string
	hint: string
	tip?: string
	value: (vendor: Vendor) => React.ReactNode
	// The vendor marked "higher" on this row, if any.
	highest: string | null
}

// The measures behind the cards: the overall score and the two it balances
// (each with "higher" on the stronger vendor), how often each agreed with
// Jev, and the disagreements left to look at. A table, one column per
// vendor, where there's room; on a narrow screen the same rows as a list,
// each measure then one line per vendor, so no figure sits off-screen.
function MeasuresTable({
	vendors,
	colourOf
}: {
	vendors: Vendor[]
	colourOf: (id: string) => number
}) {
	const t = useTranslations('Overview')
	const valueClass = 'font-mono text-[1.375rem] font-semibold tracking-[-0.03em]'
	const tipVendor = t('tipVendor')
	const percent = (value: (vendor: Vendor) => number | null) => ({
		value: (vendor: Vendor) => (
			<AnimatedPercent
				value={value(vendor)}
				emptyLabel={t('notAvailable')}
				className={valueClass}
			/>
		),
		highest: highestId(vendors, value)
	})
	const rows: MeasureRow[] = [
		{
			key: 'overall',
			label: t('f1Label'),
			hint: t('measureOverallHint'),
			tip: t('f1Tip', { vendor: tipVendor }),
			...percent((vendor) => vendor.metrics.f1)
		},
		{
			key: 'precision',
			label: t('precisionLabel'),
			hint: t('measurePrecisionHint'),
			tip: t('precisionTip', { vendor: tipVendor }),
			...percent((vendor) => vendor.metrics.precision)
		},
		{
			key: 'recall',
			label: t('recallLabel'),
			hint: t('measureRecallHint'),
			tip: t('recallTip', { vendor: tipVendor }),
			...percent((vendor) => vendor.metrics.recall)
		},
		{
			key: 'agreed',
			label: t('agreedLabel'),
			hint: t('measureAgreedHint'),
			tip: t('agreedTip', { vendor: tipVendor }),
			value: (vendor) => (
				<span className={valueClass}>
					{t(
						'agreedOf',
						{ agreed: agreedCount(vendor.metrics), total: vendor.metrics.assessed },
						EXACT_FORMATS
					)}
				</span>
			),
			highest: null
		},
		{
			key: 'disagreements',
			label: t('measureDisagreements'),
			hint: t('measureDisagreementsHint'),
			value: (vendor) => (
				<Count
					value={vendor.metrics.counts.vendor_only + vendor.metrics.counts.pairsight_only}
					className={valueClass}
				/>
			),
			highest: null
		}
	]

	return (
		<div className="bg-surface border-border mt-4 rounded-lg border p-6 md:p-7">
			<table className="w-full border-collapse @max-3xl:hidden">
				<caption className="sr-only">{t('measuresCaption')}</caption>
				<thead>
					<tr>
						<th
							scope="col"
							className="text-text-muted type-eyebrow pr-4 pb-3.5 text-left text-xs font-medium"
						>
							{t('measureColumn')}
						</th>
						{vendors.map((vendor) => (
							<th
								key={vendor.id}
								scope="col"
								className="text-text-muted type-eyebrow pr-4 pb-3.5 text-left text-xs font-medium"
							>
								<span className="flex items-center gap-2">
									<VendorSwatch index={colourOf(vendor.id)} />
									{vendor.name}
								</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody className="[&>tr]:border-border [&>tr]:border-t">
					{rows.map((row) => (
						<tr key={row.key}>
							<th scope="row" className="py-3.5 pr-4 text-left align-middle font-normal">
								<MeasureLabel label={row.label} hint={row.hint} tip={row.tip} />
							</th>
							{vendors.map((vendor) => (
								<td
									key={vendor.id}
									className="text-text py-3.5 pr-4 align-middle whitespace-nowrap"
								>
									{row.value(vendor)}
									{vendor.id === row.highest && <HigherChip />}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>

			<div className="hidden @max-3xl:block">
				<h3 className="text-text-muted type-eyebrow text-xs font-medium">{t('measureColumn')}</h3>
				<dl className="divide-border mt-1 divide-y">
					{rows.map((row) => (
						<div key={row.key} className="py-3.5">
							<dt>
								<MeasureLabel label={row.label} hint={row.hint} tip={row.tip} />
							</dt>
							{vendors.map((vendor) => (
								<dd key={vendor.id} className="mt-2 flex items-center justify-between gap-3">
									<span className="text-text-body flex min-w-0 items-center gap-2 text-sm">
										<VendorSwatch index={colourOf(vendor.id)} />
										<span className="truncate">{vendor.name}</span>
									</span>
									<span className="text-text flex shrink-0 items-center">
										{row.value(vendor)}
										{vendor.id === row.highest && <HigherChip />}
									</span>
								</dd>
							))}
						</div>
					))}
				</dl>
			</div>
		</div>
	)
}

// One card per vendor (up to three), side by side: its overall score (what
// ranks them, so the leader gets "Best overall"), its checked pairs as a
// mosaic, and their split by who says what, each count opening those pairs.
// Then the measures behind the scores, in one table. With more than one
// vendor, a card picks which vendor the rest of the page describes.
export function HeadToHead({
	vendors,
	statsByVendor,
	runThreshold,
	selectedId,
	vendorHrefs,
	categoryHrefs
}: {
	vendors: Vendor[]
	// Each vendor's counts by score, to recompute them at a previewed cut-off.
	statsByVendor: Record<string, StatsRow[]>
	runThreshold: number
	selectedId: string
	vendorHrefs: Record<string, string>
	categoryHrefs: Record<string, Partial<Record<CategoryLink, string>>>
}) {
	const t = useTranslations('Overview')
	const preview = useCutoffPreview(runThreshold)
	// A beat behind the slider while it's dragged, so the slider stays smooth.
	const threshold = useDeferredValue(preview.threshold)
	const isPreviewing = threshold !== runThreshold
	// At the run's own cut-off, the exact numbers it was decided with; at a
	// previewed one, the same counts read from the binned scores.
	// Best first, as the headline ranks them (ranking.ts), at the run's own
	// cut-off: a preview moves the numbers, never the cards under the pointer.
	const shown = rankVendors(vendors).map((vendor) => {
		const stats = statsByVendor[vendor.id]
		return isPreviewing && stats != null
			? { ...vendor, metrics: statsMetricsAt(stats, 0, threshold) }
			: vendor
	})
	// Each vendor keeps the colour of its place in the upload order on every
	// screen, whichever way the ranking falls.
	const colourOf = (id: string) =>
		Math.max(
			0,
			vendors.findIndex((vendor) => vendor.id === id)
		)
	const closestId = leadingVendorId(shown)
	const isOnly = shown.length === 1
	return (
		<section aria-labelledby="head-to-head-title" className="@container">
			<h2 id="head-to-head-title" className="sr-only">
				{isOnly && shown[0] != null
					? t('metricsTitle', { vendor: shown[0].name })
					: t('comparisonTitle')}
			</h2>
			<div
				className={cn(
					'grid grid-cols-1 gap-4',
					shown.length === 2 && '@3xl:grid-cols-2',
					shown.length >= 3 && '@3xl:grid-cols-2 @6xl:grid-cols-3'
				)}
			>
				{shown.map((vendor) => (
					<VendorCard
						key={vendor.id}
						vendor={vendor}
						colourIndex={colourOf(vendor.id)}
						isSelected={vendor.id === selectedId}
						isClosest={vendor.id === closestId}
						isOnly={isOnly}
						runThreshold={runThreshold}
						href={vendorHrefs[vendor.id] ?? ''}
						categoryHrefs={categoryHrefs[vendor.id] ?? {}}
					/>
				))}
			</div>
			<MeasuresTable vendors={shown} colourOf={colourOf} />
		</section>
	)
}

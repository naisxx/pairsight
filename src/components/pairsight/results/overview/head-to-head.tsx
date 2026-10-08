'use client'

import { useDeferredValue } from 'react'
import { EXACT_FORMATS } from '@/i18n/formats'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { AnimatedPercent } from '@/components/ui/animated-number'
import { Chip } from '@/components/ui/chip'
import { Count } from '@/components/ui/count'
import { WarningCircleIcon } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import type { Category } from '@/lib/pairsight/decisions'
import { agreedCount } from '@/lib/pairsight/agreement'
import { leadingVendorId, rankVendors } from '@/lib/pairsight/ranking'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { statsMetricsAt, type StatsRow } from '@/lib/pairsight/stats'
import { useCutoffPreview } from '../cutoff-preview'
import { PreviewNote } from '../preview-note'
import { cn } from '@/lib/cn'
import { CategoryDot, CATEGORY_STYLES } from '../../result-parts'

const ORDER: Category[] = ['both_matched', 'pairsight_only', 'vendor_only', 'neither_matched']
const PERCENT = 100

type Vendor = { id: string; name: string; metrics: VendorMetrics }
type CategoryLink = Category | 'incomplete'

function Track({
	label,
	tip,
	value,
	detail
}: {
	label: string
	tip: string
	value: number | null
	// A line under the bar, e.g. the count behind a share.
	detail?: string
}) {
	const t = useTranslations('Overview')
	return (
		<div>
			<div className="text-text-muted type-ui flex items-center gap-1">
				{label}
				<InfoTip label={t('whatIs', { metric: label })} content={tip} />
			</div>
			<AnimatedPercent
				value={value}
				emptyLabel={t('notAvailable')}
				className="text-text mt-0.5 block font-mono text-xl font-medium"
			/>
			<div aria-hidden className="bar-wipe bg-border mt-1.5 h-1.5 overflow-hidden rounded-full">
				<div
					className="bg-text h-full rounded-full transition-[width] duration-300 ease-out"
					style={{ width: `${(value ?? 0) * PERCENT}%` }}
				/>
			</div>
			{detail != null && <p className="text-text-muted mt-1.5 text-xs">{detail}</p>}
		</div>
	)
}

function VendorCard({
	vendor,
	isSelected,
	isClosest,
	runThreshold,
	isOnly,
	href,
	categoryHrefs
}: {
	vendor: Vendor
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
	const { metrics } = vendor
	const incomplete = metrics.counts.incomplete
	const nameClass = 'text-text type-heading truncate'

	return (
		<article
			className={cn(
				'bg-surface relative flex h-full flex-col rounded-lg border p-5 transition-[border-color] duration-150 ease-out md:p-6',
				isSelected ? 'border-action' : 'border-border hover:border-border-input'
			)}
		>
			<header className="flex items-start justify-between gap-3">
				{isOnly ? (
					<h3 className={nameClass}>{vendor.name}</h3>
				) : (
					// The whole card picks the vendor; the category links sit above it.
					<h3 className={nameClass}>
						<Link
							href={href}
							aria-current={isSelected ? 'true' : undefined}
							className="after:absolute after:inset-0 after:rounded-lg"
						>
							{vendor.name}
						</Link>
					</h3>
				)}
				<div className="flex shrink-0 items-center gap-2">
					{incomplete > 0 && (
						<Chip tone="warning" icon={<WarningCircleIcon size={13} />}>
							{t('provisional')}
						</Chip>
					)}
					{isClosest && <Chip tone="brand">{t('bestOverall')}</Chip>}
				</div>
			</header>

			{/* The overall score leads: it's what ranks the vendors (ranking.ts). */}
			<div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
				<AnimatedPercent
					value={metrics.f1}
					emptyLabel={t('notAvailable')}
					className="text-text font-mono text-5xl leading-none font-medium tracking-[-0.04em] md:text-6xl"
				/>
				<span className="text-text-muted type-ui relative z-[1] mb-1 flex items-center gap-1">
					{t('f1Label')}
					<InfoTip
						label={t('whatIs', { metric: t('f1Label') })}
						content={t('f1Tip', { vendor: vendor.name })}
					/>
				</span>
			</div>

			<div className="relative z-[1] mt-5 grid grid-cols-3 gap-4">
				<Track
					label={t('precisionLabel')}
					tip={t('precisionTip', { vendor: vendor.name })}
					value={metrics.precision}
				/>
				<Track
					label={t('recallLabel')}
					tip={t('recallTip', { vendor: vendor.name })}
					value={metrics.recall}
				/>
				<Track
					label={t('agreedLabel')}
					tip={t('agreedTip', { vendor: vendor.name })}
					value={metrics.assessed === 0 ? null : agreedCount(metrics) / metrics.assessed}
					detail={t(
						'agreedShare',
						{ agreed: agreedCount(metrics), total: metrics.assessed },
						EXACT_FORMATS
					)}
				/>
			</div>

			<section
				aria-label={
					isSelected ? t('categoriesLabel') : t('categoriesLabelFor', { vendor: vendor.name })
				}
				className="relative z-[1] mt-auto pt-6"
			>
				<div aria-hidden className="bar-wipe flex h-2.5 gap-0.5 overflow-hidden rounded-full">
					{ORDER.map((category) => (
						<span
							key={category}
							className={cn(
								'min-w-0 transition-[flex-grow] duration-300 ease-out',
								CATEGORY_STYLES[category].fill
							)}
							style={{ flexGrow: metrics.counts[category] }}
						/>
					))}
				</div>
				<ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-0.5 @lg:grid-cols-2">
					{ORDER.map((category) => (
						<li key={category}>
							<Link
								href={categoryHrefs[category] ?? ''}
								aria-label={t('categoryTileLabel', {
									category: tCat(category),
									count: metrics.counts[category]
								})}
								className="type-ui hover:bg-surface-hover -mx-1.5 flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors duration-150 pointer-coarse:min-h-11"
							>
								<CategoryDot category={category} className="size-2" />
								<span className="text-text-muted min-w-0 flex-1 truncate">{tCat(category)}</span>
								<Count value={metrics.counts[category]} className="text-text font-mono" />
							</Link>
						</li>
					))}
					{incomplete > 0 && (
						<li>
							<Link
								href={categoryHrefs.incomplete ?? ''}
								aria-label={t('categoryTileLabel', {
									category: tCat('incomplete'),
									count: incomplete
								})}
								className="type-ui hover:bg-surface-hover -mx-1.5 flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors duration-150 pointer-coarse:min-h-11"
							>
								<CategoryDot category="incomplete" className="size-2" />
								<span className="text-text-muted min-w-0 flex-1 truncate">
									{tCat('incomplete')}
								</span>
								<Count value={incomplete} className="text-text font-mono" />
							</Link>
						</li>
					)}
				</ul>
				<PreviewNote runThreshold={runThreshold} message="lists" className="mt-2" />
			</section>
		</article>
	)
}

// One card per vendor (up to three), side by side: its overall score (what
// ranks them, so the leader gets "Best overall"), correct merges, duplicates
// found and how often it agreed with Jev, and its pairs split by who says
// what, each count opening those pairs. With more than one vendor, a card picks which
// vendor the rest of the page describes.
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
	const closestId = leadingVendorId(shown)
	const isOnly = shown.length === 1
	const only = shown[0]
	return (
		<section aria-labelledby="head-to-head-title" className="@container">
			<h2 id="head-to-head-title" className="sr-only">
				{isOnly && only != null ? t('metricsTitle', { vendor: only.name }) : t('comparisonTitle')}
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
						isSelected={vendor.id === selectedId}
						isClosest={vendor.id === closestId}
						isOnly={isOnly}
						runThreshold={runThreshold}
						href={vendorHrefs[vendor.id] ?? ''}
						categoryHrefs={categoryHrefs[vendor.id] ?? {}}
					/>
				))}
			</div>
		</section>
	)
}

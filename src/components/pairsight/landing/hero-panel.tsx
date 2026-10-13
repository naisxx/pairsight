'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Count } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'
import type { Category } from '@/lib/pairsight/decisions'
import { cn } from '@/lib/cn'
import type { LandingVendor } from '@/server/pairsight/landing-demo'
import { Mosaic, MOSAIC_TILE } from '../mosaic'
import { formatShare } from '../results/overview/chart-theme'
import { PHONE_QUERY, useMediaQuery, usePrefersMotion } from './prefers-motion'

const LEGEND: Category[] = ['both_matched', 'vendor_only', 'pairsight_only', 'neither_matched']
// On a phone the legend leaves out the ground (both say different).
const PHONE_LEGEND = new Set<Category>(['both_matched', 'vendor_only', 'pairsight_only'])
// How long each vendor shows before the panel moves on to the next.
const AUTO_SWITCH_MS = 5_200

// The hero's demo results (pairsight-handoff Landing): a vendor switch, that
// vendor's mosaic (one tile per pair the demo checked), what each colour
// counts, and how often the vendor agrees with Jev. Until a visitor picks
// one, it moves on to the next vendor every 5.2s, a bar filling along the
// active button; the tiles recolour in a ripple from the middle.
export function HeroPanel({ vendors }: { vendors: LandingVendor[] }) {
	const t = useTranslations('HomePage')
	const tOverview = useTranslations('Overview')
	const [vendorId, setVendorId] = useState(vendors[0]?.id)
	const [hasPicked, setHasPicked] = useState(false)
	// Not on a phone, where the panel is a plain card (pairsight-handoff Phone).
	const isPhone = useMediaQuery(PHONE_QUERY)
	const isAutoSwitching = usePrefersMotion() && !isPhone && !hasPicked && vendors.length > 1

	useEffect(() => {
		if (!isAutoSwitching) return
		const timer = window.setTimeout(() => {
			const index = vendors.findIndex((candidate) => candidate.id === vendorId)
			setVendorId(vendors[(index + 1) % vendors.length]?.id)
		}, AUTO_SWITCH_MS)
		return () => window.clearTimeout(timer)
	}, [isAutoSwitching, vendorId, vendors])

	const vendor = vendors.find((candidate) => candidate.id === vendorId) ?? vendors[0]
	if (vendor == null) return null
	const { counts } = vendor

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div
					role="group"
					aria-label={t('chooseVendor')}
					className="flex flex-wrap gap-2 max-[599px]:w-full max-[599px]:flex-nowrap"
				>
					{vendors.map((candidate) => {
						const isOn = candidate.id === vendor.id
						return (
							<button
								key={candidate.id}
								type="button"
								aria-pressed={isOn}
								onClick={() => {
									setHasPicked(true)
									setVendorId(candidate.id)
								}}
								className={cn(
									'landing-press relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-[10px] border px-[18px] font-semibold transition-[background-color,color,border-color] duration-200 max-[599px]:flex-1 max-[599px]:px-2',
									isOn
										? 'bg-inverse text-on-inverse border-inverse'
										: 'border-border text-text-body hover:border-border-strong hover:text-text'
								)}
							>
								{candidate.name}
								{isOn && isAutoSwitching && (
									// Restarts with each vendor, so it fills in step with the timer.
									<span key={vendorId} aria-hidden className="landing-vendor-timer" />
								)}
							</button>
						)
					})}
				</div>
				<p className="text-text-muted font-mono text-[0.8125rem] leading-[18px] tracking-[0.06em] uppercase max-[599px]:hidden">
					{t('liveFromDemo')}
				</p>
			</div>
			<Mosaic
				ripple
				mosaic={{ tiles: vendor.tiles, perTile: 1 }}
				label={tOverview(
					'mosaicLabel',
					{ tiles: vendor.tiles.length, vendor: vendor.name },
					EXACT_FORMATS
				)}
				className="landing-mosaic mt-5 mb-4 gap-1 max-[599px]:mt-4 max-[599px]:gap-0.5 [&>span]:rounded-[4px] max-[599px]:[&>span]:rounded-[3px]"
			/>
			<ul className="text-text-body flex flex-wrap gap-x-5 gap-y-2 text-sm max-[599px]:gap-x-[18px] max-[599px]:gap-y-1.5 max-[599px]:text-[13px]">
				{LEGEND.map((category) => (
					<li
						key={category}
						className={cn(
							'flex items-center gap-2',
							!PHONE_LEGEND.has(category) && 'max-[599px]:hidden'
						)}
					>
						<span aria-hidden className={cn('size-3 rounded-[3px]', MOSAIC_TILE[category])} />
						<span>
							<Count value={counts[category]} />{' '}
							<span className="max-[599px]:hidden">{tOverview(`legend.${category}`)}</span>
							<span className="min-[600px]:hidden">{t(`legendShort.${category}`)}</span>
						</span>
					</li>
				))}
			</ul>
			<p className="border-border mt-4 border-t pt-4 text-[17px] leading-[26px] max-[599px]:mt-3.5 max-[599px]:pt-3.5 max-[599px]:text-base max-[599px]:leading-6">
				{t.rich(
					isPhone ? 'panelAgreedShort' : 'panelAgreed',
					{
						vendor: vendor.name,
						agreed: counts.both_matched + counts.neither_matched,
						total: vendor.checked,
						score: formatShare(vendor.f1, '—'),
						n: (chunks) => <strong className="font-mono">{chunks}</strong>
					},
					EXACT_FORMATS
				)}
			</p>
		</>
	)
}

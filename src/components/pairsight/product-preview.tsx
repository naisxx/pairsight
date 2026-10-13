import { useTranslations } from 'next-intl'
import type { LandingVendor } from '@/server/pairsight/landing-demo'
import { formatShare } from './results/overview/chart-theme'
import { Mosaic, MOSAIC_TILE } from './mosaic'
import { VendorSwatch } from './vendor-swatch'

// The legend's order, as on Results: who says same, from both to neither.
const LEGEND = ['both_matched', 'vendor_only', 'pairsight_only', 'neither_matched'] as const

// A still picture of Results for the empty dashboard, drawn from the demo's
// real products run (landing-demo.ts), best vendor first: the leading
// vendor's card as Results shows it (its overall score, its mosaic and who
// says what), and the runner-up's score under it. Purely illustrative: a
// screen reader hears one sentence, not the miniature.
export function ProductPreview({ vendors }: { vendors: LandingVendor[] }) {
	const t = useTranslations('ProductPreview')
	const tOverview = useTranslations('Overview')
	const [leader, ...others] = vendors
	if (leader == null) return null
	const score = 'font-mono font-semibold tracking-[-0.03em]'

	return (
		<div
			role="img"
			aria-label={t('label', {
				vendor: leader.name,
				f1: formatShare(leader.f1, '—'),
				checked: leader.checked
			})}
			className="border-border bg-bg rounded-lg border p-5 select-none @3xl:p-6"
		>
			<div aria-hidden className="border-border bg-surface rounded-lg border p-5">
				<div className="flex items-baseline justify-between gap-3">
					<p className="font-display flex min-w-0 items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
						<VendorSwatch index={leader.colour} />
						<span className="truncate">{leader.name}</span>
					</p>
					<p className="flex shrink-0 items-baseline gap-1.5">
						<span className={`${score} text-2xl`}>{formatShare(leader.f1, '—')}</span>
						<span className="text-text-muted text-xs">{tOverview('overallShort')}</span>
					</p>
				</div>
				<Mosaic mosaic={{ tiles: leader.tiles, perTile: 1 }} label="" className="mt-4" />
				<ul className="text-text-body mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
					{LEGEND.map((category) => (
						<li key={category} className="flex items-center gap-1.5">
							<span className={`size-2.5 rounded-[2px] ${MOSAIC_TILE[category]}`} />
							<span className="font-mono">{leader.counts[category]}</span>
							{tOverview(`legend.${category}`)}
						</li>
					))}
				</ul>
			</div>
			{others.map((vendor) => (
				<div
					aria-hidden
					key={vendor.id}
					className="border-border bg-surface mt-2 flex items-baseline justify-between gap-3 rounded-lg border px-5 py-3"
				>
					<p className="flex min-w-0 items-center gap-2 text-sm font-medium">
						<VendorSwatch index={vendor.colour} />
						<span className="truncate">{vendor.name}</span>
					</p>
					<p className="flex shrink-0 items-baseline gap-1.5">
						<span className={`${score} text-base`}>{formatShare(vendor.f1, '—')}</span>
						<span className="text-text-muted text-xs">{tOverview('overallShort')}</span>
					</p>
				</div>
			))}
		</div>
	)
}

'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Segmented } from '@/components/ui/segmented'
import { VendorSwatch } from '../../vendor-swatch'

// Which vendor the rest of the Overview is about (where to look first, how
// the cut-off holds, why they disagree), said and switched in one place
// between the cards and those panels. Best first, as the cards are; each
// vendor in its own colour (vendor-swatch.tsx).
export function VendorSwitch({
	vendors,
	selectedId,
	hrefs
}: {
	vendors: Array<{ id: string; name: string; colour: number }>
	selectedId: string
	hrefs: Record<string, string>
}) {
	const t = useTranslations('Overview')
	const router = useRouter()
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<p className="text-text-muted text-sm">{t('detailsFor')}</p>
			<Segmented
				label={t('detailsForLabel')}
				value={selectedId}
				onChange={(id) => {
					const href = hrefs[id]
					if (href != null) router.replace(href, { scroll: false })
				}}
				isFill="narrow"
				options={vendors.map((vendor) => ({
					value: vendor.id,
					label: (
						<>
							<VendorSwatch index={vendor.colour} />
							{vendor.name}
						</>
					)
				}))}
			/>
		</div>
	)
}

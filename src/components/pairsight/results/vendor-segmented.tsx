'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Segmented } from '@/components/ui/segmented'

// Which vendor the page describes, with two or more. Each opens that
// vendor's view of the same results.
export function VendorSegmented({
	vendors,
	vendorId,
	hrefs
}: {
	vendors: Array<{ id: string; name: string }>
	vendorId: string
	hrefs: Record<string, string>
}) {
	const t = useTranslations('Results')
	const router = useRouter()
	return (
		<Segmented
			label={t('vendorLabel')}
			value={vendorId}
			onChange={(id) => {
				const href = hrefs[id]
				if (href != null) router.push(href)
			}}
			options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
		/>
	)
}

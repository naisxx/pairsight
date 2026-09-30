import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import { toQuery } from './query'

// One tab per vendor, shown only when there is more than one.
export function VendorTabs({
	base,
	vendors,
	vendorId
}: {
	base: string
	vendors: Array<{ id: string; name: string }>
	vendorId: string | undefined
}) {
	const t = useTranslations('Results')
	if (vendors.length < 2) return null
	return (
		<nav aria-label={t('vendor')} className="border-border mb-5 flex gap-1 border-b">
			{vendors.map((vendor) => (
				<Link
					key={vendor.id}
					href={{ pathname: `${base}/results`, query: toQuery({ vendor: vendor.id }) }}
					aria-current={vendor.id === vendorId ? 'page' : undefined}
					className={cn(
						'-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
						vendor.id === vendorId
							? 'border-action text-text'
							: 'text-text-muted hover:text-text border-transparent'
					)}
				>
					{vendor.name}
				</Link>
			))}
		</nav>
	)
}

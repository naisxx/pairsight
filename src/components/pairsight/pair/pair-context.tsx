import { useTranslations } from 'next-intl'
import type { ResultCategory } from '@/server/pairsight/results'
import { CategoryBadge } from '../result-parts'

// Why this pair was compared: the blocking rules that found it, or the vendor
// match that added it from outside the rules.
export function PairOrigin({
	ruleLabels,
	matchingVendors
}: {
	ruleLabels: string[]
	matchingVendors: string[]
}) {
	const t = useTranslations('Pair')
	return (
		<section className="border-border bg-surface rounded-lg border p-4">
			<h2 className="text-text mb-2 text-sm font-semibold">{t('originTitle')}</h2>
			<p className="text-text text-sm">
				{ruleLabels.length > 0
					? t('originRules', { rules: ruleLabels.join('; ') })
					: t('originVendor', { vendors: matchingVendors.join(', ') || '—' })}
			</p>
		</section>
	)
}

// Each vendor's category for this pair, when more than one vendor is compared.
export function VendorDecisions({
	vendors
}: {
	vendors: Array<{ id: string; name: string; category: ResultCategory }>
}) {
	const t = useTranslations('Pair')
	if (vendors.length < 2) return null
	return (
		<section className="border-border bg-surface rounded-lg border p-4">
			<h2 className="text-text mb-2 text-sm font-semibold">{t('vendorsTitle')}</h2>
			<ul className="flex flex-col gap-2">
				{vendors.map((vendor) => (
					<li key={vendor.id} className="flex items-center justify-between gap-2 text-sm">
						<span className="text-text">{vendor.name}</span>
						<CategoryBadge category={vendor.category} />
					</li>
				))}
			</ul>
		</section>
	)
}

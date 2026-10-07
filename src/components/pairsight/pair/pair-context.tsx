import { useTranslations } from 'next-intl'
import { FlowIcon } from '@/components/ui/icons'
import type { ResultCategory } from '@/server/pairsight/results'
import { CategoryBadge } from '../result-parts'

// Why this pair was compared: PairSight suggested it (and why), or a vendor
// matched it and it was added so every vendor match is checked.
export function PairOrigin({
	isSuggested,
	matchingVendors,
	suggestedBecause = []
}: {
	isSuggested: boolean
	matchingVendors: string[]
	// When PairSight suggested it: what the two records share, in words.
	suggestedBecause?: string[]
}) {
	const t = useTranslations('Pair')
	return (
		<section
			aria-labelledby="origin-title"
			className="border-border bg-surface rounded-md border p-4"
		>
			<h2 id="origin-title" className="type-subheading flex items-center gap-2">
				<FlowIcon className="text-text-muted" />
				{t('originTitle')}
			</h2>
			<p className="type-ui mt-2">
				{isSuggested
					? suggestedBecause.length > 0
						? t('originSuggested', { reasons: suggestedBecause.join(', ') })
						: t('originSuggestedPlain')
					: t('originVendor', { vendors: matchingVendors.join(t('and')) || '—' })}
			</p>
			<p className="text-text-muted mt-2 text-xs">{t('originNote')}</p>
		</section>
	)
}

// Each vendor's decision and category for this pair, when more than one
// vendor is compared.
export function VendorDecisions({
	vendors
}: {
	vendors: Array<{ id: string; name: string; isMatch: boolean; category: ResultCategory }>
}) {
	const t = useTranslations('Pair')
	if (vendors.length < 2) return null
	return (
		<section
			aria-labelledby="vendors-title"
			className="border-border bg-surface rounded-md border p-4"
		>
			<h2 id="vendors-title" className="type-subheading">
				{t('vendorsTitle')}
			</h2>
			<ul className="divide-border mt-2 divide-y">
				{vendors.map((vendor) => (
					<li
						key={vendor.id}
						className="type-ui flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2"
					>
						<span className="min-w-0">{vendor.name}</span>
						<span className="flex items-center gap-2">
							<span className={vendor.isMatch ? 'font-medium' : 'text-text-muted'}>
								{vendor.isMatch ? t('matched') : t('notMatched')}
							</span>
							<CategoryBadge category={vendor.category} />
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

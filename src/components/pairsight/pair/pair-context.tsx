import { useTranslations } from 'next-intl'

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
			className="bg-surface border-border rounded-lg border p-6 md:p-7"
		>
			<h2 id="origin-title" className="text-text-muted type-eyebrow">
				{t('originTitle')}
			</h2>
			<p className="text-text-body mt-3 text-base">
				{isSuggested
					? suggestedBecause.length > 0
						? t('originSuggested', { reasons: suggestedBecause.join(', ') })
						: t('originSuggestedPlain')
					: t('originVendor', { vendors: matchingVendors.join(t('and')) || '—' })}
			</p>
			<p className="text-text-muted mt-3 text-sm">{t('originNote')}</p>
		</section>
	)
}

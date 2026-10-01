import { useTranslations } from 'next-intl'
import type { ResultCategory } from '@/server/pairsight/results'
import { CategoryBadge } from '../result-parts'

// "Vendor A: match · PairSight: no match" with its category, qualified as
// agreement rather than correctness.
export function VerdictStrip({
	category,
	vendorName,
	isVendorMatch,
	pairsightDecision
}: {
	category: ResultCategory
	vendorName: string
	isVendorMatch: boolean
	pairsightDecision: string
}) {
	const t = useTranslations('Pair')
	return (
		<div className="border-border bg-surface mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-4">
			<CategoryBadge category={category} />
			<h1 className="text-text type-heading">
				{t('verdict', {
					vendor: vendorName,
					vendorDecision: isVendorMatch ? t('match') : t('noMatch'),
					pairsightDecision
				})}
			</h1>
			<span className="text-text-muted type-meta">{t('agreementNote')}</span>
		</div>
	)
}

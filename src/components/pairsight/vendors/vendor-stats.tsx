import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { VendorFileStats } from '@/server/pairsight/vendors'
import { Count } from '@/components/ui/count'

// What a vendor file adds up to: its pairs, and what was cleaned up or
// couldn't be matched to a record.
export function VendorStats({
	stats,
	unknownCount
}: {
	stats: VendorFileStats
	unknownCount: number
}) {
	const t = useTranslations('Vendors')
	const items = [
		{
			label: t('statPairs'),
			value: stats.pairs,
			note:
				stats.groups == null ? t('statPairsUnique') : t('statPairsGroups', { count: stats.groups }),
			isProblem: false
		},
		{
			label: t('statDuplicates'),
			value: stats.duplicates,
			note: t('statDuplicatesNote'),
			isProblem: false
		},
		{ label: t('statSelf'), value: stats.selfPairs, note: t('statSelfNote'), isProblem: false },
		{
			label: t('statUnknown'),
			value: unknownCount,
			note: unknownCount === 0 ? t('statUnknownNone') : t('statUnknownSome'),
			isProblem: unknownCount > 0
		}
	]
	return (
		<dl
			aria-label={t('statsLabel')}
			className="border-border @3xl:divide-border mt-4 grid grid-cols-2 overflow-hidden rounded-sm border @3xl:grid-cols-4 @3xl:divide-x"
		>
			{items.map((item) => (
				<div key={item.label} className="border-border border-b p-3 @3xl:border-b-0">
					<dt className="text-text-muted truncate text-xs" title={item.label}>
						{item.label}
					</dt>
					<dd
						className={cn(
							'mt-1 font-mono text-[20px] leading-none font-medium',
							item.isProblem && 'text-danger'
						)}
					>
						<Count value={item.value} />
					</dd>
					<dd className="text-text-muted type-caption mt-1">{item.note}</dd>
				</div>
			))}
		</dl>
	)
}

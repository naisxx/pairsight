import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { RuleStats } from '@/server/pairsight/blocking'

// A rule's buckets, pairs and largest bucket, as three right-aligned columns.
export function RuleStatColumns({
	stat,
	bucketWarningSize,
	isMuted = false
}: {
	stat: RuleStats | undefined
	bucketWarningSize: number
	isMuted?: boolean
}) {
	const t = useTranslations('Rules')
	const items = [
		{ label: t('statBuckets'), value: stat?.bucketCount, isWarning: false },
		{ label: t('statPairs'), value: stat?.pairCount, isWarning: false },
		{
			label: t('statLargest'),
			value: stat?.largestBucket,
			isWarning: stat != null && stat.largestBucket > bucketWarningSize
		}
	]
	return (
		<dl className={cn('grid grid-cols-3 gap-4 text-right', isMuted && 'opacity-60')}>
			{items.map((item) => (
				<div key={item.label}>
					<dt className="text-text-muted type-caption">{item.label}</dt>
					<dd className={cn('type-ui font-mono', item.isWarning && 'text-warning font-semibold')}>
						{item.value ?? '—'}
					</dd>
				</div>
			))}
		</dl>
	)
}

// A rule's sample key, the parts joined the way the rule combines them.
export function SampleKey({ parts }: { parts: string[] | null }) {
	return <code className="text-text font-mono">{parts == null ? '∅' : parts.join(' · ')}</code>
}

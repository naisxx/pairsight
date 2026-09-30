'use client'

import { useTranslations } from 'next-intl'
import { AlertIcon } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { BlockingField } from '@/server/pairsight/normalize'
import { RULE_COPY } from './rule-copy'

// The first field a rule needs that isn't mapped (a "name" rule is satisfied
// by a full name or by first + last), or null when the rule can run.
export function missingField(fields: BlockingField[], mapped: ReadonlySet<IdentityRole>) {
	for (const field of fields) {
		const isMissing =
			field === 'name'
				? !mapped.has('full_name') && !(mapped.has('first_name') && mapped.has('last_name'))
				: !mapped.has(field)
		if (isMissing) return field
	}
	return null
}

// One blocking rule: what it matches and how it normalizes, its live stats,
// and a workload warning for oversized groups.
export function BlockingRuleCard({
	rule,
	missing,
	stat,
	isOn,
	bucketWarningSize,
	onToggle
}: {
	rule: { id: string; fields: BlockingField[] }
	missing: BlockingField | null
	stat: RuleStats | undefined
	isOn: boolean
	bucketWarningSize: number
	onToggle: (isOn: boolean) => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const copy = RULE_COPY[rule.id]
	return (
		<li
			className={cn(
				'flex flex-col gap-2 rounded-lg border p-4 transition-colors',
				isOn ? 'border-action/50 bg-accent/40' : 'border-border'
			)}
		>
			<label className="flex items-start justify-between gap-3">
				<span className="flex flex-col gap-0.5">
					<span className="text-text text-sm font-semibold">
						{copy != null ? t(copy.title) : rule.fields.map((field) => tRoles(field)).join(' + ')}
					</span>
					{copy != null && <span className="text-text-muted text-xs">{t(copy.hint)}</span>}
				</span>
				<Switch checked={isOn} disabled={missing != null} onCheckedChange={onToggle} />
			</label>
			{missing != null ? (
				<p className="text-text-muted text-xs">
					{t('ruleUnavailable', { field: tRoles(missing) })}
				</p>
			) : stat != null ? (
				<>
					<p className="text-text-muted text-xs tabular-nums">
						{stat.bucketCount === 0
							? t('statsNone')
							: t('stats', {
									buckets: stat.bucketCount,
									pairs: stat.pairCount,
									largest: stat.largestBucket
								})}
						{stat.recordsWithoutKey > 0 &&
							` · ${t('withoutValue', { count: stat.recordsWithoutKey })}`}
					</p>
					{stat.largestBucket > bucketWarningSize &&
						stat.oversizedBuckets.map((bucket) => (
							<p
								key={`${bucket.size}-${bucket.pairCount}`}
								className="text-warning flex items-start gap-1.5 text-xs"
							>
								<AlertIcon size={14} className="mt-px shrink-0" />
								{t('bucketWarning', { size: bucket.size, pairs: bucket.pairCount })}
							</p>
						))}
				</>
			) : null}
		</li>
	)
}

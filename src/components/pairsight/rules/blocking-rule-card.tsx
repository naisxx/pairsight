'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, TrashIcon } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { BlockingField } from '@/server/pairsight/normalize'
import { RULE_COPY } from './rule-copy'

export type RuleLimits = { bucketWarningSize: number; maxPairsPerRun: number }

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

// What a rule would contribute: groups, pairs, largest group, plus workload
// warnings for oversized groups and for a rule that alone breaks the cap.
export function RuleStatsLine({ stat, limits }: { stat: RuleStats; limits: RuleLimits }) {
	const t = useTranslations('Rules')
	return (
		<>
			<p className="text-text-muted type-data-sm">
				{stat.bucketCount === 0
					? t('statsNone')
					: t('stats', {
							buckets: stat.bucketCount,
							pairs: stat.pairCount,
							largest: stat.largestBucket
						})}
				{stat.recordsWithoutKey > 0 && ` · ${t('withoutValue', { count: stat.recordsWithoutKey })}`}
			</p>
			{stat.pairCount > limits.maxPairsPerRun && (
				<p className="text-danger type-meta flex items-start gap-1.5">
					<AlertIcon size={14} className="mt-px shrink-0" />
					{t('ruleOverCap', { pairs: stat.pairCount, limit: limits.maxPairsPerRun })}
				</p>
			)}
			{stat.largestBucket > limits.bucketWarningSize &&
				stat.oversizedBuckets.map((bucket) => (
					<p
						key={`${bucket.size}-${bucket.pairCount}`}
						className="text-warning type-meta flex items-start gap-1.5"
					>
						<AlertIcon size={14} className="mt-px shrink-0" />
						{t('bucketWarning', { size: bucket.size, pairs: bucket.pairCount })}
					</p>
				))}
		</>
	)
}

// The rule's key: the field ids it matches on, in the data voice, so the
// friendly title above reads as a label and this as the definition.
function RuleKey({ fields }: { fields: readonly BlockingField[] }) {
	const t = useTranslations('Rules')
	return (
		<p className="flex flex-wrap items-center gap-1" aria-label={t('ruleKey')}>
			{fields.map((field, index) => (
				<span key={field} className="flex items-center gap-1">
					{index > 0 && <span className="text-text-muted type-data-sm">+</span>}
					<code className="border-border bg-surface-muted text-text type-data-sm rounded border px-1.5">
						{field}
					</code>
				</span>
			))}
		</p>
	)
}

// One blocking rule: what it matches and how it normalizes, and its live
// stats. Presets toggle; custom rules are always on and are removed instead,
// since only enabled rules are saved.
export function BlockingRuleCard({
	rule,
	missing,
	stat,
	isOn,
	limits,
	onToggle,
	onRemove
}: {
	rule: { id: string; fields: BlockingField[] }
	missing: BlockingField | null
	stat: RuleStats | undefined
	isOn: boolean
	limits: RuleLimits
	onToggle: (isOn: boolean) => void
	onRemove?: () => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const copy = RULE_COPY[rule.id]
	const title = copy != null ? t(copy.title) : rule.fields.map((field) => tRoles(field)).join(' + ')
	return (
		<li
			className={cn(
				'flex flex-col gap-2 rounded-lg border p-4 transition-colors',
				isOn ? 'border-action/50 bg-selected' : 'border-border'
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<span className="flex flex-col gap-0.5">
					<span className="text-text type-subheading">{title}</span>
					<span className="text-text-muted type-meta">
						{copy != null ? t(copy.hint) : t('customHint')}
					</span>
				</span>
				{onRemove != null ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRemove}
						aria-label={t('removeRule', { rule: title })}
					>
						<TrashIcon />
					</Button>
				) : (
					<Switch
						checked={isOn}
						disabled={missing != null}
						onCheckedChange={onToggle}
						aria-label={title}
					/>
				)}
			</div>
			<RuleKey fields={rule.fields} />
			{missing != null ? (
				<p className="text-text-muted type-meta">
					{t('ruleUnavailable', { field: tRoles(missing) })}
				</p>
			) : stat != null ? (
				<RuleStatsLine stat={stat} limits={limits} />
			) : null}
		</li>
	)
}

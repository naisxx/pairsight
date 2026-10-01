'use client'

import { Fragment, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, EditIcon, PlusIcon, TrashIcon } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { isCustomRuleId, MAX_CUSTOM_RULES } from '@/lib/pairsight/custom-rules'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { BlockingField } from '@/server/pairsight/normalize'
import { CompositeRuleEditor } from './composite-rule-editor'
import { RULE_COPY } from './rule-copy'
import { missingField, type Rule, type RuleLimits } from './rule-fields'
import { RuleStatColumns, SampleKey } from './rule-stats'

const ICON_SIZE = 15
const SMALL_ICON_SIZE = 14

// Blocking: the presets, each switched on or off, and composite rules the
// user builds, edits or deletes. Every rule shows what it compares on and
// what it would contribute.
export function CandidateRules({
	evaluationId,
	country,
	rules,
	enabled,
	stats,
	mapped,
	availableFields,
	limits,
	onToggle,
	onSaveComposite,
	onDeleteComposite
}: {
	evaluationId: string
	country: string
	rules: Rule[]
	enabled: ReadonlySet<string>
	stats: (ruleId: string) => RuleStats | undefined
	mapped: ReadonlySet<IdentityRole>
	availableFields: readonly BlockingField[]
	limits: RuleLimits
	onToggle: (ruleId: string, isOn: boolean) => void
	// `replacing` is the composite being edited, absent for a new one.
	onSaveComposite: (rule: Rule, stat: RuleStats, replacing?: string) => void
	onDeleteComposite: (ruleId: string) => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const [editing, setEditing] = useState<string | 'new' | null>(null)
	const presets = rules.filter((rule) => !isCustomRuleId(rule.id))
	const composites = rules.filter((rule) => isCustomRuleId(rule.id))
	const label = (rule: Rule) => {
		const copy = RULE_COPY[rule.id]
		return copy == null ? rule.fields.map((field) => tRoles(field)).join(' + ') : t(copy.title)
	}

	return (
		<section aria-labelledby="rules-title" className="border-border bg-surface rounded-md border">
			<header className="px-5 pt-4 pb-2">
				<p className="text-accent-ink text-xs font-medium">{t('blockingEyebrow')}</p>
				<h2 id="rules-title" className="mt-0.5 text-base font-semibold">
					{t('blockingTitle')}
				</h2>
				<p className="type-ui text-text-muted mt-1 max-w-2xl leading-relaxed">
					{t('blockingDescription')}
				</p>
			</header>

			<div className="px-5 pt-2">
				<h3 className="text-text-muted text-xs font-medium">{t('presets')}</h3>
				<ul className="mt-1">
					{presets.map((rule) => {
						const missing = missingField(rule.fields, mapped)
						const isOn = enabled.has(rule.id) && missing == null
						const stat = stats(rule.id)
						const copy = RULE_COPY[rule.id]
						const id = `preset-${rule.id}`
						return (
							<li
								key={rule.id}
								className="border-border flex flex-col gap-3 border-b py-3 md:flex-row md:items-center"
							>
								<div className="flex min-w-0 flex-1 items-start gap-3">
									<div className="pt-0.5">
										<Switch
											id={id}
											checked={isOn}
											disabled={missing != null}
											onCheckedChange={(checked) => onToggle(rule.id, checked)}
											aria-label={t('ruleToggle', { rule: label(rule) })}
										/>
									</div>
									<div className="min-w-0">
										<label
											htmlFor={id}
											className={cn('type-ui font-medium', !isOn && 'text-text-muted')}
										>
											{label(rule)}
										</label>
										{missing != null ? (
											<p className="text-text-muted text-xs">
												{t('ruleUnavailable', { field: tRoles(missing) })}
											</p>
										) : (
											<p className="text-text-muted mt-0.5 truncate text-xs">
												{copy != null && `${t(copy.hint)} · `}
												{t('example')} <SampleKey parts={stat?.sampleKey ?? null} />
												{stat != null &&
													stat.recordsWithoutKey > 0 &&
													` · ${t('skipped', { count: stat.recordsWithoutKey })}`}
											</p>
										)}
										{missing == null && stat != null && (
											<RuleWarnings stat={stat} limits={limits} />
										)}
									</div>
								</div>
								<div className="md:w-[220px]">
									<RuleStatColumns
										stat={missing == null ? stat : undefined}
										bucketWarningSize={limits.bucketWarningSize}
										isMuted={!isOn}
									/>
								</div>
							</li>
						)
					})}
				</ul>
			</div>

			<div className="px-5 pt-4 pb-5">
				<div className="flex items-center justify-between">
					<h3 className="text-text-muted text-xs font-medium">{t('composites')}</h3>
					{editing !== 'new' && composites.length < MAX_CUSTOM_RULES && (
						<Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
							<PlusIcon size={SMALL_ICON_SIZE} />
							{t('addComposite')}
						</Button>
					)}
				</div>
				<ul className="mt-1">
					{composites.map((rule) => {
						const stat = stats(rule.id)
						const others = rules.filter((other) => other.id !== rule.id)
						if (editing === rule.id) {
							return (
								<li key={rule.id} className="py-3">
									<CompositeRuleEditor
										evaluationId={evaluationId}
										country={country}
										availableFields={availableFields}
										otherRules={others}
										initial={rule.fields}
										limits={limits}
										onCancel={() => setEditing(null)}
										onSave={(next, nextStat) => {
											onSaveComposite(next, nextStat, rule.id)
											setEditing(null)
										}}
									/>
								</li>
							)
						}
						return (
							<li
								key={rule.id}
								className="border-border flex flex-col gap-3 border-b py-3 md:flex-row md:items-center"
							>
								<div className="min-w-0 flex-1">
									<p className="type-ui flex flex-wrap items-center gap-1.5 font-medium">
										{rule.fields.map((field, index) => (
											<Fragment key={field}>
												{index > 0 && <span className="text-text-muted">+</span>}
												<span className="border-border bg-surface-muted rounded-[5px] border px-1.5 py-0.5 text-xs">
													{tRoles(field)}
												</span>
											</Fragment>
										))}
									</p>
									<p className="text-text-muted mt-1 text-xs">
										{t('example')} <SampleKey parts={stat?.sampleKey ?? null} />
									</p>
									{stat != null && <RuleWarnings stat={stat} limits={limits} />}
								</div>
								<div className="flex items-center gap-3">
									<div className="md:w-[220px]">
										<RuleStatColumns stat={stat} bucketWarningSize={limits.bucketWarningSize} />
									</div>
									<Tip content={t('editTip')}>
										<Button
											variant="quiet"
											size="icon"
											aria-label={t('editRule', { rule: label(rule) })}
											onClick={() => setEditing(rule.id)}
										>
											<EditIcon size={ICON_SIZE} />
										</Button>
									</Tip>
									<Tip content={t('deleteTip')}>
										<Button
											variant="quiet"
											size="icon"
											aria-label={t('deleteRule', { rule: label(rule) })}
											onClick={() => onDeleteComposite(rule.id)}
										>
											<TrashIcon size={ICON_SIZE} />
										</Button>
									</Tip>
								</div>
							</li>
						)
					})}
				</ul>
				{composites.length === 0 && editing !== 'new' && (
					<p className="text-text-muted py-3 text-xs">{t('noComposites')}</p>
				)}
				{composites.length >= MAX_CUSTOM_RULES && (
					<p className="text-text-muted py-2 text-xs">
						{t('customLimit', { max: MAX_CUSTOM_RULES })}
					</p>
				)}
				{editing === 'new' && (
					<div className="pt-3">
						<CompositeRuleEditor
							evaluationId={evaluationId}
							country={country}
							availableFields={availableFields}
							otherRules={rules}
							limits={limits}
							onCancel={() => setEditing(null)}
							onSave={(next, nextStat) => {
								onSaveComposite(next, nextStat)
								setEditing(null)
							}}
						/>
					</div>
				)}
			</div>
		</section>
	)
}

// What a rule would cost in workload: over the run's pair cap on its own, or
// a bucket big enough to be worth splitting. Never about accuracy.
function RuleWarnings({ stat, limits }: { stat: RuleStats; limits: RuleLimits }) {
	const t = useTranslations('Rules')
	return (
		<>
			{stat.pairCount > limits.maxPairsPerRun && (
				<p className="text-danger mt-1.5 flex items-start gap-1.5 text-xs">
					<AlertIcon size={SMALL_ICON_SIZE} className="mt-px shrink-0" />
					{t('ruleOverCap', { pairs: stat.pairCount, limit: limits.maxPairsPerRun })}
				</p>
			)}
			{stat.oversizedBuckets.map((bucket) => (
				<p
					key={`${bucket.size}-${bucket.pairCount}`}
					className="text-warning mt-1.5 flex items-start gap-1.5 text-xs"
				>
					<AlertIcon size={SMALL_ICON_SIZE} className="mt-px shrink-0" />
					{t('oversized', { size: bucket.size, pairs: bucket.pairCount })}
				</p>
			))}
		</>
	)
}

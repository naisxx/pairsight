'use client'

import { Fragment, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { AlertIcon, EditIcon, InfoIcon, PlusIcon, TrashIcon } from '@/components/ui/icons'
import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { isCustomRuleId, MAX_CUSTOM_RULES } from '@/lib/pairsight/custom-rules'
import { isFuzzyRule } from '@/lib/pairsight/derived-keys'
import { ruleFieldLabel } from '../rule-field-label'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { BaseField, BlockingField } from '@/lib/pairsight/entity-types'
import { CompositeRuleEditor } from './composite-rule-editor'
import { RULE_COPY } from './rule-copy'
import { missingField, type Rule, type RuleLimits } from '@/lib/pairsight/rule-fields'
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
	availableFields: readonly BaseField[]
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
		return copy == null
			? rule.fields
					.map((field) => ruleFieldLabel({ field, tRules: t, tRoles }))
					.join(` ${t('and')} `)
			: t(copy.title)
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
				<HowRulesCombine />
			</header>

			<div className="px-5 pt-2">
				<h3 className="text-text-muted text-xs font-medium">{t('presets')}</h3>
				{presets.some(isFuzzyRule) && (
					<p className="text-text-muted mt-1 max-w-2xl text-xs leading-relaxed">
						<FuzzyTag /> {t('fuzzyNote')}
					</p>
				)}
				<ul className="mt-1">
					{presets.map((rule, index) => {
						const missing = missingField(rule.fields, mapped)
						const isOn = enabled.has(rule.id) && missing == null
						const stat = stats(rule.id)
						const copy = RULE_COPY[rule.id]
						const id = `preset-${rule.id}`
						return (
							<Fragment key={rule.id}>
								{index > 0 && <OrDivider />}
								<li className="flex flex-col gap-3 py-3 @3xl:flex-row @3xl:items-center">
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
											{isFuzzyRule(rule) && (
												<>
													{' '}
													<FuzzyTag />
												</>
											)}
											{rule.fields.length > 1 && (
												<FieldChips fields={rule.fields} isMuted={!isOn} />
											)}
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
									<div className="@3xl:w-[220px]">
										<RuleStatColumns
											stat={missing == null ? stat : undefined}
											bucketWarningSize={limits.bucketWarningSize}
											isMuted={!isOn}
										/>
									</div>
								</li>
							</Fragment>
						)
					})}
				</ul>
			</div>

			<div className="px-5 pb-5">
				{composites.length > 0 && <OrDivider />}
				<div className="flex items-center justify-between pt-2">
					<h3 className="text-text-muted text-xs font-medium">{t('composites')}</h3>
					{editing !== 'new' && composites.length < MAX_CUSTOM_RULES && (
						<Button variant="ghost" size="sm" onClick={() => setEditing('new')}>
							<PlusIcon size={SMALL_ICON_SIZE} />
							{t('addComposite')}
						</Button>
					)}
				</div>
				<ul className="mt-1">
					{composites.map((rule, index) => {
						const stat = stats(rule.id)
						const others = rules.filter((other) => other.id !== rule.id)
						const divider = index > 0 && <OrDivider />
						if (editing === rule.id) {
							return (
								<Fragment key={rule.id}>
									{divider}
									<li className="py-3">
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
								</Fragment>
							)
						}
						return (
							<Fragment key={rule.id}>
								{divider}
								<li className="flex flex-col gap-3 py-3 @3xl:flex-row @3xl:items-center">
									<div className="min-w-0 flex-1">
										<FieldChips fields={rule.fields} isFuzzy={isFuzzyRule(rule)} />
										<p className="text-text-muted mt-1 text-xs">
											{t('example')} <SampleKey parts={stat?.sampleKey ?? null} />
										</p>
										{stat != null && <RuleWarnings stat={stat} limits={limits} />}
									</div>
									<div className="flex items-center gap-3">
										<div className="@3xl:w-[220px]">
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
							</Fragment>
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

// How the rules combine, on hover or focus so it stays out of the way: any
// rule is enough (OR), and every field in one rule has to match (AND).
function HowRulesCombine() {
	const t = useTranslations('Rules')
	const content = (
		<dl className="flex flex-col gap-2 py-1">
			<div>
				<dt className="flex items-center gap-1.5 font-medium">
					{t('combineAnyTitle')} <OperatorTag operator="or" />
				</dt>
				<dd className="text-text-muted mt-0.5">{t('combineAnyBody')}</dd>
			</div>
			<div>
				<dt className="flex items-center gap-1.5 font-medium">
					{t('combineAllTitle')} <OperatorTag operator="and" />
				</dt>
				<dd className="text-text-muted mt-0.5">{t('combineAllBody')}</dd>
			</div>
		</dl>
	)
	return (
		<Tip content={content} side="bottom">
			<button
				type="button"
				className="text-text-muted hover:text-text type-ui mt-2 inline-flex items-center gap-1.5 rounded-xs text-xs transition-colors duration-150"
			>
				<InfoIcon size={SMALL_ICON_SIZE} />
				{t('combineLabel')}
				<OperatorTag operator="or" />
				<OperatorTag operator="and" />
			</button>
		</Tip>
	)
}

// Between two rules: either one finding a pair is enough. Decorative; the
// combining rule is said in words above.
function OrDivider() {
	return (
		<li aria-hidden className="flex items-center gap-2">
			<span className="border-border flex-1 border-t border-dashed" />
			<OperatorTag operator="or" />
			<span className="border-border flex-1 border-t border-dashed" />
		</li>
	)
}

// OR and AND each keep one colour everywhere they appear, so the two read
// apart at a glance.
const OPERATOR_TONE = {
	or: 'border-info text-info bg-info-subtle',
	and: 'border-warning text-warning bg-warning-subtle'
} as const

function OperatorTag({ operator }: { operator: keyof typeof OPERATOR_TONE }) {
	const t = useTranslations('Rules')
	return (
		<span
			className={cn(
				'rounded-xs border px-1 py-px font-mono text-[10px] leading-none font-semibold tracking-wide',
				OPERATOR_TONE[operator]
			)}
		>
			{t(operator)}
		</span>
	)
}

// A rule's fields, joined by AND: all of them must match for the rule to put
// two records together.
function FieldChips({
	fields,
	isMuted = false,
	isFuzzy = false
}: {
	fields: readonly BlockingField[]
	isMuted?: boolean
	// A custom rule has no title to carry the tag, so its chips do.
	isFuzzy?: boolean
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	return (
		<p
			className={cn(
				'type-ui mt-1 flex flex-wrap items-center gap-1.5 font-medium',
				isMuted && 'opacity-70'
			)}
		>
			{fields.map((field, index) => (
				<Fragment key={field}>
					{index > 0 && <OperatorTag operator="and" />}
					<span className="border-border bg-surface-muted rounded-[5px] border px-1.5 py-0.5 text-xs">
						{ruleFieldLabel({ field, tRules: t, tRoles })}
					</span>
				</Fragment>
			))}
			{isFuzzy && <FuzzyTag />}
		</p>
	)
}

// Marks a rule that matches on a derived key: it finds more, and adds pairs.
function FuzzyTag() {
	const t = useTranslations('Rules')
	return <Chip tone="info">{t('fuzzy')}</Chip>
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

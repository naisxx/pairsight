'use client'

import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, SpinnerIcon } from '@/components/ui/icons'
import { OptionSelect } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import {
	derivedField,
	isFuzzyRule,
	needsPartner,
	parseRuleField,
	transformsFor,
	type KeyTransform
} from '@/lib/pairsight/derived-keys'
import type { BaseField } from '@/lib/pairsight/entity-types'
import { customRule, hasSameFields, MAX_RULE_FIELDS } from '@/lib/pairsight/custom-rules'
import { COUNTRY_CODE_PATTERN } from '@/lib/pairsight/input-limits'
import { previewRuleAction } from '@/server/actions/pairsight/rules'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { BlockingField } from '@/server/pairsight/normalize'
import type { Rule, RuleLimits } from '@/lib/pairsight/rule-fields'
import { ruleFieldLabel } from '../rule-field-label'
import { SampleKey } from './rule-stats'

const ICON_SIZE = 14
const SPINNER_SIZE = 12

// Builds (or edits) a rule of up to three fields that must all match, with
// its buckets counted on the server as the fields change, so what it would
// add is visible before it's saved.
export function CompositeRuleEditor({
	evaluationId,
	country,
	availableFields,
	otherRules,
	initial = [],
	limits,
	onSave,
	onCancel
}: {
	evaluationId: string
	country: string
	availableFields: readonly BaseField[]
	// Every rule but the one being edited, to catch duplicates.
	otherRules: readonly Rule[]
	initial?: readonly BlockingField[]
	limits: RuleLimits
	onSave: (rule: Rule, stat: RuleStats) => void
	onCancel: () => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const [fields, setFields] = useState<BlockingField[]>([...initial])
	const rule = customRule(fields)
	const isDuplicate =
		fields.length > 0 && otherRules.some((existing) => hasSameFields(existing.fields, fields))
	const isTooBroad = needsPartner(fields)
	const canPreview =
		fields.length > 0 && !isDuplicate && !isTooBroad && COUNTRY_CODE_PATTERN.test(country)
	const fieldLabel = (field: BlockingField) => ruleFieldLabel({ field, tRules: t, tRoles })
	const label = fields.map(fieldLabel).join(` ${t('and')} `)
	const bases = fields.map((field) => parseRuleField(field).base)

	const preview = useQuery({
		queryKey: ['pairsight', 'rule-preview', evaluationId, country.toUpperCase(), rule.id],
		queryFn: async () => {
			const result = await previewRuleAction({
				evaluationId,
				fields: rule.fields,
				countryCode: country
			})
			if (!result.ok) throw new Error(result.error)
			return result.data
		},
		enabled: canPreview
	})
	const stat = canPreview ? preview.data : undefined
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>

	// A field is picked as it is; "Match on" then derives it, in place.
	function toggle(base: BaseField) {
		setFields((current) =>
			current.some((field) => parseRuleField(field).base === base)
				? current.filter((field) => parseRuleField(field).base !== base)
				: [...current, base]
		)
	}

	function matchOn(base: BaseField, transform: KeyTransform | null) {
		setFields((current) =>
			current.map((field) =>
				parseRuleField(field).base === base
					? transform == null
						? base
						: derivedField(base, transform)
					: field
			)
		)
	}

	return (
		<div className="border-border-input bg-surface-muted rounded-sm border p-4">
			<p className="type-ui font-medium">{t('editorTitle')}</p>
			<p className="text-text-muted mt-0.5 text-xs">{t('editorDescription')}</p>
			<div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('editorFields')}>
				{availableFields.map((field) => {
					const order = bases.indexOf(field)
					const isOn = order !== -1
					return (
						<button
							key={field}
							type="button"
							aria-pressed={isOn}
							disabled={!isOn && fields.length >= MAX_RULE_FIELDS}
							onClick={() => toggle(field)}
							className={cn(
								'bg-surface inline-flex h-7 items-center gap-1.5 rounded-[6px] border px-2.5 text-xs font-medium transition-[background-color,border-color] duration-150 disabled:opacity-50',
								isOn ? 'border-action text-text' : 'border-border text-text-muted hover:text-text'
							)}
						>
							{isOn && <span className="text-accent-ink font-mono text-[10px]">{order + 1}</span>}
							{tRoles(field)}
						</button>
					)
				})}
			</div>
			{fields.some((field) => transformsFor(parseRuleField(field).base).length > 0) && (
				<div className="mt-3 flex flex-col gap-2">
					{fields.map((field) => {
						const { base, transform } = parseRuleField(field)
						const transforms = transformsFor(base)
						if (transforms.length === 0) return null
						return (
							<MatchOn
								key={base}
								field={tRoles(base)}
								value={transform}
								transforms={transforms}
								onChange={(next) => matchOn(base, next)}
							/>
						)
					})}
				</div>
			)}
			<div className="border-border bg-surface mt-3 rounded-sm border p-3 text-xs">
				{fields.length === 0 ? (
					<p className="text-text-muted">{t('editorPick')}</p>
				) : isTooBroad ? (
					<p className="text-warning">
						{t('editorNeedsPartner', { field: fields.map(fieldLabel).join(` ${t('and')} `) })}
					</p>
				) : isDuplicate ? (
					<p className="text-danger">{t('customDuplicate')}</p>
				) : preview.isError ? (
					<p role="alert" className="text-danger">
						{preview.error.message}
					</p>
				) : stat == null ? (
					<p className="text-text-muted flex items-center gap-1.5">
						<SpinnerIcon size={SPINNER_SIZE} />
						{t('customCounting')}
					</p>
				) : (
					<>
						<p>
							<span className="font-medium">{label}</span>
							{isFuzzyRule(rule) && <span className="text-info"> · {t('fuzzy')}</span>}
							<span className="text-text-muted"> · {t('example')} </span>
							{stat.sampleKey == null ? (
								<code className="font-mono">{t('editorMissingKey')}</code>
							) : (
								<SampleKey parts={stat.sampleKey} />
							)}
						</p>
						<p className="text-text-muted mt-1">
							{t.rich('editorStats', {
								buckets: stat.bucketCount,
								pairs: stat.pairCount,
								largest: stat.largestBucket,
								n: mono
							})}
							{stat.recordsWithoutKey > 0 &&
								t.rich('editorSkipped', { count: stat.recordsWithoutKey, n: mono })}
						</p>
						{stat.pairCount > limits.maxPairsPerRun && (
							<p className="text-danger mt-2 flex items-start gap-1.5">
								<AlertIcon size={ICON_SIZE} className="mt-px shrink-0" />
								{t('ruleOverCap', { pairs: stat.pairCount, limit: limits.maxPairsPerRun })}
							</p>
						)}
						{stat.oversizedBuckets.map((bucket) => (
							<p
								key={`${bucket.size}-${bucket.pairCount}`}
								className="text-warning mt-2 flex items-start gap-1.5"
							>
								<AlertIcon size={ICON_SIZE} className="mt-px shrink-0" />
								{t('oversized', { size: bucket.size, pairs: bucket.pairCount })}
							</p>
						))}
					</>
				)}
			</div>
			<div className="mt-3 flex gap-2">
				<Button
					size="sm"
					disabled={stat == null || preview.isFetching}
					onClick={() => {
						if (stat != null) onSave(rule, stat)
					}}
				>
					{t('saveRule')}
				</Button>
				<Button variant="secondary" size="sm" onClick={onCancel}>
					{t('cancel')}
				</Button>
			</div>
		</div>
	)
}

// How one picked field is matched: as it is, or derived from it.
function MatchOn({
	field,
	value,
	transforms,
	onChange
}: {
	field: string
	value: KeyTransform | null
	transforms: readonly KeyTransform[]
	onChange: (transform: KeyTransform | null) => void
}) {
	const t = useTranslations('Rules')
	const id = useId()
	const exact = 'exact'
	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			<label htmlFor={id} className="text-text-muted min-w-[140px]">
				{t('editorMatchOn', { field })}
			</label>
			<OptionSelect
				id={id}
				size="sm"
				className="w-[180px]"
				value={value ?? exact}
				onValueChange={(next) =>
					onChange(transforms.find((transform) => transform === next) ?? null)
				}
				options={[
					{ value: exact, label: t('matchExact') },
					...transforms.map((transform) => ({
						value: transform,
						label: t(`transform.${transform}`)
					}))
				]}
			/>
		</div>
	)
}

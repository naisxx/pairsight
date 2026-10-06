'use client'

import { useEffect, useEffectEvent, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, InfoIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'
import type { SelectOption } from '@/components/ui/select'
import { BLOCKING_FIELDS, isCustomRuleId, MIN_JEV_FIELDS } from '@/lib/pairsight/custom-rules'
import { saveRulesAction } from '@/server/actions/pairsight/rules'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { CandidateRules } from './candidate-rules'
import { IdentitySection } from './identity-section'
import { missingField, type Rule, type RuleLimits } from '@/lib/pairsight/rule-fields'
import { RulesSummary, type RulesSummaryData } from './rules-summary'
import { ThresholdSection } from './threshold-section'
import { useEvaluationView } from '../evaluation-context'
import { ReadOnlyFieldset } from '../read-only'

// A change is saved once typing pauses this long.
const AUTOSAVE_DELAY_MS = 700
const ICON_SIZE = 15

type Draft = {
	same: string
	different: string
	country: string
	jevFields: ReadonlySet<IdentityRole>
	enabled: ReadonlySet<string>
	composites: Rule[]
	threshold: number
}

// A comparable form of what would be saved, so the form is "unsaved"
// exactly when saving would change something. Only presets that can run count:
// one switched on for a column that isn't mapped is never saved.
function snapshot(draft: Draft, presets: Rule[]): string {
	return JSON.stringify([
		draft.same.trim(),
		draft.different.trim(),
		draft.country,
		[...draft.jevFields].sort(),
		presets.filter((rule) => draft.enabled.has(rule.id)).map((rule) => rule.id),
		draft.composites.map((rule) => rule.id).sort(),
		draft.threshold
	])
}

function toggled<T>(set: ReadonlySet<T>, value: T, isOn: boolean): Set<T> {
	const next = new Set(set)
	if (isOn) next.add(value)
	else next.delete(value)
	return next
}

// The Rules step. Every change saves itself (when valid) a moment after it's
// made, and the page then recounts the rules and the summary from what was
// saved; runs keep their own copy of the settings, so this never changes a
// past result.
export function RulesForm({
	evaluationId,
	initial,
	rules,
	mappedRoles,
	stats,
	summary,
	countries,
	limits
}: {
	evaluationId: string
	initial: {
		identitySame: string
		identityDifferent: string
		countryCode: string
		jevFields: IdentityRole[]
		enabledRuleIds: string[]
		threshold: number
	}
	rules: Rule[]
	mappedRoles: IdentityRole[]
	stats: RuleStats[]
	summary: RulesSummaryData
	countries: SelectOption[]
	limits: RuleLimits
}) {
	const t = useTranslations('Rules')
	const tSandbox = useTranslations('Sandbox')
	const router = useRouter()
	const view = useEvaluationView()
	const mapped = new Set(mappedRoles)
	const presets = rules.filter((rule) => !isCustomRuleId(rule.id))
	const runnablePresets = presets.filter((rule) => missingField(rule.fields, mapped) == null)
	const saved: Draft = {
		same: initial.identitySame,
		different: initial.identityDifferent,
		country: initial.countryCode,
		jevFields: new Set(initial.jevFields.filter((field) => mapped.has(field))),
		enabled: new Set(initial.enabledRuleIds),
		composites: rules.filter((rule) => isCustomRuleId(rule.id)),
		threshold: initial.threshold
	}
	const [draft, setDraft] = useState<Draft>(saved)
	// Stats for composites added or edited here, until the server counts
	// them after the save (server stats win).
	const [addedStats, setAddedStats] = useState<Record<string, RuleStats>>({})
	const [error, setError] = useState<string | null>(null)
	const [isSaving, startSaving] = useTransition()

	const isDirty = snapshot(draft, runnablePresets) !== snapshot(saved, runnablePresets)
	const invalidReason =
		draft.same.trim() === ''
			? t('blockedSame')
			: draft.different.trim() === ''
				? t('blockedDifferent')
				: draft.jevFields.size < MIN_JEV_FIELDS
					? t('blockedFields')
					: null
	const allRules = [...presets, ...draft.composites]
	const payload = {
		evaluationId,
		identity: { same: draft.same, different: draft.different },
		countryCode: draft.country,
		jevFields: [...draft.jevFields],
		threshold: draft.threshold,
		// Presets that are on and runnable, plus every composite.
		blockingRules: allRules.filter(
			(rule) =>
				isCustomRuleId(rule.id) ||
				(draft.enabled.has(rule.id) && missingField(rule.fields, mapped) == null)
		)
	}
	// The sandbox never saves: its controls are disabled, and this makes sure.
	const isPending = !view.isReadOnly && (isSaving || (isDirty && invalidReason == null))

	function save() {
		startSaving(async () => {
			const result = await saveRulesAction(payload)
			if (!result.ok) {
				setError(result.error)
				return
			}
			setError(null)
			router.refresh()
		})
	}

	const saveSoon = useEffectEvent(() => save())
	const draftKey = snapshot(draft, runnablePresets)
	const canSave = !view.isReadOnly && isDirty && invalidReason == null
	useEffect(() => {
		if (!canSave) return
		const timer = setTimeout(saveSoon, AUTOSAVE_DELAY_MS)
		return () => clearTimeout(timer)
	}, [draftKey, canSave])

	// Leaving mid-pause still saves the last change.
	const saveOnLeave = useEffectEvent(() => {
		if (canSave) void saveRulesAction(payload)
	})
	useEffect(() => () => saveOnLeave(), [])

	const blockedReason =
		invalidReason ??
		(summary.total > summary.limit
			? summary.isExact
				? t('blockedOver', { limit: summary.limit, total: summary.total })
				: t('blockedOverMany', { limit: summary.limit })
			: isPending
				? t('blockedSaving')
				: null)

	return (
		<>
			<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
				<ReadOnlyFieldset className="space-y-4 @5xl:col-span-8">
					<IdentitySection
						same={draft.same}
						different={draft.different}
						country={draft.country}
						countries={countries}
						mappedRoles={mappedRoles}
						jevFields={draft.jevFields}
						onChange={({ field, ...text }) =>
							setDraft((current) => ({
								...current,
								...text,
								jevFields:
									field == null
										? current.jevFields
										: toggled(current.jevFields, field.role, field.isOn)
							}))
						}
					/>
					<ThresholdSection
						value={draft.threshold}
						onChange={(threshold) => setDraft((current) => ({ ...current, threshold }))}
					/>
					<CandidateRules
						evaluationId={evaluationId}
						country={draft.country}
						rules={allRules}
						enabled={draft.enabled}
						stats={(ruleId) =>
							stats.find((candidate) => candidate.ruleId === ruleId) ?? addedStats[ruleId]
						}
						mapped={mapped}
						availableFields={BLOCKING_FIELDS.filter(
							(field) => missingField([field], mapped) == null
						)}
						limits={limits}
						onToggle={(ruleId, isOn) =>
							setDraft((current) => ({
								...current,
								enabled: toggled(current.enabled, ruleId, isOn)
							}))
						}
						onSaveComposite={(rule, stat, replacing) => {
							setAddedStats((current) => ({ ...current, [rule.id]: stat }))
							setDraft((current) => ({
								...current,
								composites:
									replacing == null
										? [...current.composites, rule]
										: current.composites.map((existing) =>
												existing.id === replacing ? rule : existing
											)
							}))
						}}
						onDeleteComposite={(ruleId) =>
							setDraft((current) => ({
								...current,
								composites: current.composites.filter((rule) => rule.id !== ruleId)
							}))
						}
					/>
				</ReadOnlyFieldset>
				<div className="@5xl:col-span-4">
					<RulesSummary summary={summary} isUpdating={isPending} />
				</div>
			</div>

			<ActionBar
				back={{ href: `${view.base}/vendors`, label: t('back') }}
				hint={
					view.isReadOnly ? (
						<>
							<InfoIcon size={ICON_SIZE} className="shrink-0" />
							<span>{tSandbox('readOnlyStatus')}</span>
						</>
					) : error != null ? (
						<span role="alert" className="text-danger">
							{t('statusFailed', { error })}
						</span>
					) : blockedReason != null ? (
						<>
							{isPending && invalidReason == null ? (
								<SpinnerIcon size={ICON_SIZE} className="shrink-0" />
							) : (
								<InfoIcon size={ICON_SIZE} className="shrink-0" />
							)}
							<span>{blockedReason}</span>
						</>
					) : (
						<>
							<SuccessIcon size={ICON_SIZE} className="shrink-0" />
							<span>{t('statusSaved')}</span>
						</>
					)
				}
			>
				{blockedReason == null && error == null ? (
					<Button asChild>
						<Link href={`${view.base}/plan`}>
							{t('continue')}
							<ArrowRightIcon size={ICON_SIZE} />
						</Link>
					</Button>
				) : (
					<Button disabled aria-describedby={ACTION_HINT_ID}>
						{t('continue')}
						<ArrowRightIcon size={ICON_SIZE} />
					</Button>
				)}
			</ActionBar>
		</>
	)
}

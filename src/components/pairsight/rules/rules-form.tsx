'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { AlertIcon, ArrowRightIcon, SpinnerIcon } from '@/components/ui/icons'
import { BLOCKING_FIELDS, isCustomRuleId } from '@/lib/pairsight/custom-rules'
import { saveRulesAction } from '@/server/actions/pairsight/rules'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { BlockingField } from '@/server/pairsight/normalize'
import { ActionBar, Section } from '../step-layout'
import { UnsavedChangesDialog } from '../unsaved-changes-dialog'
import { useUnsavedChangesGuard } from '../use-unsaved-changes-guard'
import { BlockingRuleCard, missingField, type RuleLimits } from './blocking-rule-card'
import { CustomRuleBuilder } from './custom-rule-builder'
import { IdentitySection } from './identity-section'
import { JevFieldsSection } from './jev-fields-section'
import { UnsavedCountryNotice } from './unsaved-country-notice'

type Rule = { id: string; fields: BlockingField[] }

// A comparable snapshot of what "Review plan" would save, so the form is
// dirty exactly when saving would change something.
function configSnapshot(config: {
	same: string
	different: string
	country: string
	jevFields: Iterable<string>
	enabledRuleIds: Iterable<string>
	customRuleIds: Iterable<string>
}): string {
	return JSON.stringify([
		config.same.trim(),
		config.different.trim(),
		config.country.trim().toUpperCase(),
		[...config.jevFields].sort(),
		[...config.enabledRuleIds].sort(),
		[...config.customRuleIds].sort()
	])
}

function toggled<T>(set: ReadonlySet<T>, value: T, isOn: boolean): Set<T> {
	const next = new Set(set)
	if (isOn) next.add(value)
	else next.delete(value)
	return next
}

// The Rules step: owns the draft configuration and saves it on "Review plan".
export function RulesForm({
	evaluationId,
	initial,
	rules,
	mappedRoles,
	stats,
	limits
}: {
	evaluationId: string
	initial: {
		identitySame: string
		identityDifferent: string
		countryCode: string
		jevFields: IdentityRole[]
		enabledRuleIds: string[]
	}
	rules: Rule[]
	mappedRoles: IdentityRole[]
	stats: RuleStats[]
	limits: RuleLimits
}) {
	const t = useTranslations('Rules')
	const router = useRouter()
	const mapped = new Set(mappedRoles)
	const [same, setSame] = useState(initial.identitySame)
	const [different, setDifferent] = useState(initial.identityDifferent)
	const [country, setCountry] = useState(initial.countryCode)
	const [jevFields, setJevFields] = useState(
		new Set(initial.jevFields.filter((field) => mapped.has(field)))
	)
	const [enabled, setEnabled] = useState(new Set(initial.enabledRuleIds))
	const [customRules, setCustomRules] = useState(() =>
		rules.filter((rule) => isCustomRuleId(rule.id))
	)
	// Stats for custom rules added in this session, until a save makes the
	// server count them (server stats win, so a recount replaces these).
	const [addedStats, setAddedStats] = useState<Record<string, RuleStats>>({})
	const allRules = [...rules.filter((rule) => !isCustomRuleId(rule.id)), ...customRules]
	const availableFields = BLOCKING_FIELDS.filter((field) => missingField([field], mapped) == null)
	const [error, setError] = useState<string | null>(null)
	const [isSaving, startSaving] = useTransition()

	const isDirty =
		configSnapshot({
			same,
			different,
			country,
			jevFields,
			enabledRuleIds: allRules.filter((rule) => enabled.has(rule.id)).map((rule) => rule.id),
			customRuleIds: customRules.map((rule) => rule.id)
		}) !==
		configSnapshot({
			same: initial.identitySame,
			different: initial.identityDifferent,
			country: initial.countryCode,
			jevFields: initial.jevFields.filter((field) => mapped.has(field)),
			enabledRuleIds: initial.enabledRuleIds,
			customRuleIds: rules.filter((rule) => isCustomRuleId(rule.id)).map((rule) => rule.id)
		})
	const guard = useUnsavedChangesGuard(isDirty)

	// Only phone keys depend on the country, so the notice only matters when
	// a phone column is mapped.
	const isCountryUnsaved =
		mapped.has('phone') && country.trim().toUpperCase() !== initial.countryCode.toUpperCase()

	// Saves the draft, then either moves on to the plan or stays and
	// re-renders, so the server recounts the presets with what was saved.
	function save(then: 'plan' | 'recount') {
		setError(null)
		startSaving(async () => {
			const result = await saveRulesAction({
				evaluationId,
				identity: { same, different },
				countryCode: country,
				jevFields: [...jevFields],
				blockingRules: allRules.filter((rule) => enabled.has(rule.id))
			})
			if (!result.ok) return setError(result.error)
			if (then === 'recount') return router.refresh()
			const planPath = `/evaluations/${evaluationId}/plan`
			if (guard.beginLeave().shouldReplace) router.replace(planPath)
			else router.push(planPath)
		})
	}

	function addCustomRule(rule: Rule, stat: RuleStats) {
		setCustomRules((current) => [...current, rule])
		setAddedStats((current) => ({ ...current, [rule.id]: stat }))
		setEnabled((current) => toggled(current, rule.id, true))
	}

	function removeCustomRule(ruleId: string) {
		setCustomRules((current) => current.filter((rule) => rule.id !== ruleId))
		setEnabled((current) => toggled(current, ruleId, false))
	}

	return (
		<div className="flex flex-col gap-6">
			<IdentitySection
				same={same}
				different={different}
				country={country}
				onSameChange={setSame}
				onDifferentChange={setDifferent}
				onCountryChange={setCountry}
			/>
			<JevFieldsSection
				mappedRoles={mappedRoles}
				selected={jevFields}
				onToggle={(role, isOn) => setJevFields((current) => toggled(current, role, isOn))}
			/>
			<Section title={t('blockingTitle')} description={t('blockingDescription')}>
				{isCountryUnsaved && (
					<div className="mb-3">
						<UnsavedCountryNotice
							savedCountry={initial.countryCode}
							isSaving={isSaving}
							onSave={() => save('recount')}
						/>
					</div>
				)}
				<ul className="grid gap-3 md:grid-cols-2">
					{allRules.map((rule) => {
						const missing = missingField(rule.fields, mapped)
						const isCustom = isCustomRuleId(rule.id)
						return (
							<BlockingRuleCard
								key={rule.id}
								rule={rule}
								missing={missing}
								stat={
									stats.find((candidate) => candidate.ruleId === rule.id) ?? addedStats[rule.id]
								}
								isOn={enabled.has(rule.id) && missing == null}
								limits={limits}
								onToggle={(isOn) => setEnabled((current) => toggled(current, rule.id, isOn))}
								onRemove={isCustom ? () => removeCustomRule(rule.id) : undefined}
							/>
						)
					})}
				</ul>
				<div className="mt-3">
					<CustomRuleBuilder
						evaluationId={evaluationId}
						country={country}
						availableFields={availableFields}
						rules={allRules}
						customCount={customRules.length}
						limits={limits}
						onAdd={addCustomRule}
					/>
				</div>
			</Section>
			{error != null && (
				<p
					role="alert"
					className="bg-danger-subtle text-danger flex items-center gap-2 rounded px-3 py-2 text-sm"
				>
					<AlertIcon />
					{error}
				</p>
			)}
			<UnsavedChangesDialog isOpen={guard.isConfirming} onStay={guard.stay} onLeave={guard.leave} />
			<ActionBar>
				<Button onClick={() => save('plan')} disabled={isSaving || jevFields.size === 0}>
					{isSaving ? <SpinnerIcon /> : null}
					{isSaving ? t('saving') : t('continue')}
					{!isSaving && <ArrowRightIcon />}
				</Button>
			</ActionBar>
		</div>
	)
}

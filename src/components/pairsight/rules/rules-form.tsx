'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { AlertIcon, ArrowRightIcon, SpinnerIcon } from '@/components/ui/icons'
import { saveRulesAction } from '@/server/actions/pairsight/rules'
import type { RuleStats } from '@/server/pairsight/blocking'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { BlockingField } from '@/server/pairsight/normalize'
import { ActionBar, Section } from '../step-layout'
import { BlockingRuleCard, missingField } from './blocking-rule-card'
import { IdentitySection } from './identity-section'
import { JevFieldsSection } from './jev-fields-section'

type Rule = { id: string; fields: BlockingField[] }

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
	bucketWarningSize
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
	bucketWarningSize: number
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
	const [error, setError] = useState<string | null>(null)
	const [isSaving, startSaving] = useTransition()

	function save() {
		setError(null)
		startSaving(async () => {
			const result = await saveRulesAction({
				evaluationId,
				identity: { same, different },
				countryCode: country,
				jevFields: [...jevFields],
				blockingRules: rules.filter((rule) => enabled.has(rule.id))
			})
			if (!result.ok) return setError(result.error)
			router.push(`/evaluations/${evaluationId}/plan`)
		})
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
				<ul className="grid gap-3 md:grid-cols-2">
					{rules.map((rule) => {
						const missing = missingField(rule.fields, mapped)
						return (
							<BlockingRuleCard
								key={rule.id}
								rule={rule}
								missing={missing}
								stat={stats.find((candidate) => candidate.ruleId === rule.id)}
								isOn={enabled.has(rule.id) && missing == null}
								bucketWarningSize={bucketWarningSize}
								onToggle={(isOn) => setEnabled((current) => toggled(current, rule.id, isOn))}
							/>
						)
					})}
				</ul>
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
			<ActionBar>
				<Button onClick={save} disabled={isSaving || jevFields.size === 0}>
					{isSaving ? <SpinnerIcon /> : null}
					{isSaving ? t('saving') : t('continue')}
					{!isSaving && <ArrowRightIcon />}
				</Button>
			</ActionBar>
		</div>
	)
}

'use client'

import { useEffect, useEffectEvent, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, InfoIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'
import type { SelectOption } from '@/components/ui/select'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/entity-types'
import { saveRulesAction } from '@/server/actions/pairsight/rules'
import type { IdentityRole } from '@/server/pairsight/fields'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { IdentitySection } from './identity-section'
import { SuggestionsCard, type SuggestionsData } from './suggestions-card'
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
	threshold: number
}

// A comparable form of what would be saved, so the form is "unsaved"
// exactly when saving would change something.
function snapshot(draft: Draft): string {
	return JSON.stringify([
		draft.same.trim(),
		draft.different.trim(),
		draft.country,
		[...draft.jevFields].sort(),
		draft.threshold
	])
}

function toggled<T>(set: ReadonlySet<T>, value: T, isOn: boolean): Set<T> {
	const next = new Set(set)
	if (isOn) next.add(value)
	else next.delete(value)
	return next
}

// The "What Jev checks" step: when two records are the same, what Jev sees,
// and the match cut-off; beside them, the pairs PairSight suggests. Every
// change saves itself (when valid) a moment after it's made; runs keep their
// own copy of the settings, so this never changes a past result.
export function RulesForm({
	evaluationId,
	initial,
	mappedRoles,
	suggestions,
	countries
}: {
	evaluationId: string
	initial: {
		identitySame: string
		identityDifferent: string
		countryCode: string
		jevFields: IdentityRole[]
		threshold: number
	}
	mappedRoles: IdentityRole[]
	// What PairSight suggests for these records (SuggestionsCard).
	suggestions: SuggestionsData
	countries: SelectOption[]
}) {
	const t = useTranslations('Rules')
	const tSandbox = useTranslations('Sandbox')
	const router = useRouter()
	const view = useEvaluationView()
	const mapped = new Set(mappedRoles)
	const saved: Draft = {
		same: initial.identitySame,
		different: initial.identityDifferent,
		country: initial.countryCode,
		jevFields: new Set(initial.jevFields.filter((field) => mapped.has(field))),
		threshold: initial.threshold
	}
	const [draft, setDraft] = useState<Draft>(saved)
	const [error, setError] = useState<string | null>(null)
	const [isSaving, startSaving] = useTransition()

	const isDirty = snapshot(draft) !== snapshot(saved)
	const invalidReason =
		draft.same.trim() === ''
			? t('blockedSame')
			: draft.different.trim() === ''
				? t('blockedDifferent')
				: draft.jevFields.size < MIN_JEV_FIELDS
					? t('blockedFields')
					: null
	const payload = {
		evaluationId,
		identity: { same: draft.same, different: draft.different },
		countryCode: draft.country,
		jevFields: [...draft.jevFields],
		threshold: draft.threshold
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
	const draftKey = snapshot(draft)
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

	const blockedReason = invalidReason ?? (isPending ? t('blockedSaving') : null)

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
				</ReadOnlyFieldset>
				<div className="@5xl:col-span-4">
					<SuggestionsCard data={suggestions} />
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

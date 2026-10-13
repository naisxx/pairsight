'use client'

import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, InfoIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'
import type { SelectOption } from '@/components/ui/select'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/entity-types'
import { captureClientError } from '@/lib/observability/capture-client-error'
import { dismissToast, toast } from '@/lib/toast'
import { saveRulesAction } from '@/server/actions/pairsight/rules'
import type { IdentityRole } from '@/server/pairsight/fields'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { IdentitySection, JevFieldsSection, type CountryGuessHint } from './identity-section'
import { SuggestionsCard, type SuggestionsData } from './suggestions-card'
import { ThresholdSection } from './threshold-section'
import { useEvaluationView } from '../evaluation-context'
import { ReadOnlyFieldset } from '../read-only'

// A change is saved once typing pauses this long.
const AUTOSAVE_DELAY_MS = 700
// How long a save can be taken back: long enough to notice and reach Undo.
const UNDO_MS = 10_000
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
// own copy of the settings, so this never changes a past result. Each save
// can be taken back for a few seconds (Undo, on a toast); a run of edits
// close together undoes as one, back to before the first.
export function RulesForm({
	evaluationId,
	initial,
	suggested,
	mappedRoles,
	idColumn,
	suggestions,
	countries,
	countryGuess
}: {
	evaluationId: string
	initial: {
		identitySame: string
		identityDifferent: string
		countryCode: string
		jevFields: IdentityRole[]
		threshold: number
	}
	// The record type's own wording, to go back to.
	suggested: { same: string; different: string }
	mappedRoles: IdentityRole[]
	// The record ID's column, which Jev never sees.
	idColumn: string
	// What PairSight suggests for these records (SuggestionsCard).
	suggestions: SuggestionsData
	countries: SelectOption[]
	// Where the file looked to be from, when the country was set from it.
	countryGuess: CountryGuessHint | null
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

	// The save that Undo would go back to, while its toast is up.
	const undo = useRef<{ toastId: string; base: Draft; until: number } | null>(null)
	// The next save is an Undo going through, not a change to offer one for.
	const isRestoring = useRef(false)

	function restore(base: Draft) {
		if (undo.current != null) dismissToast(undo.current.toastId)
		undo.current = null
		isRestoring.current = true
		setDraft(base)
	}

	function offerUndo(before: Draft) {
		const now = Date.now()
		const current = undo.current
		// Still within the last one's time: Undo goes back past both.
		const base = current != null && now < current.until ? current.base : before
		if (current != null) dismissToast(current.toastId)
		const toastId = toast({
			title: t('savedToast'),
			durationMs: UNDO_MS,
			action: { label: t('undo'), onClick: () => restore(base) }
		})
		undo.current = { toastId, base, until: now + UNDO_MS }
	}

	function save() {
		const before = saved
		startSaving(async () => {
			const result = await saveRulesAction(payload)
			if (!result.ok) {
				setError(result.error)
				return
			}
			setError(null)
			router.refresh()
			if (isRestoring.current) {
				isRestoring.current = false
				toast({ title: t('undoneToast') })
			} else {
				offerUndo(before)
			}
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
	// If that fails, say so on the next page rather than lose it quietly.
	// Undo belongs to this page: it closes on the way out, so it's never
	// offered over the next step (or a run started from these settings).
	const saveOnLeave = useEffectEvent(() => {
		if (undo.current != null) dismissToast(undo.current.toastId)
		undo.current = null
		if (!canSave) return
		saveRulesAction(payload).then(
			(result) => {
				if (!result.ok) {
					toast({ variant: 'destructive', title: t('leaveSaveFailed'), description: result.error })
				}
			},
			(cause: unknown) => {
				const { userMessage } = captureClientError(cause, { evaluationId })
				toast({ variant: 'destructive', title: t('leaveSaveFailed'), description: userMessage })
			}
		)
	})
	useEffect(() => () => saveOnLeave(), [])

	const blockedReason = invalidReason ?? (isPending ? t('blockedSaving') : null)

	return (
		<>
			{/* The four cards, one under another, in the order they're decided. */}
			<ReadOnlyFieldset className="flex flex-col gap-4">
				<IdentitySection
					same={draft.same}
					different={draft.different}
					country={draft.country}
					countries={countries}
					countryGuess={countryGuess}
					suggested={suggested}
					onChange={(text) => setDraft((current) => ({ ...current, ...text }))}
				/>
				<JevFieldsSection
					mappedRoles={mappedRoles}
					jevFields={draft.jevFields}
					idColumn={idColumn}
					onToggle={(role, isOn) =>
						setDraft((current) => ({
							...current,
							jevFields: toggled(current.jevFields, role, isOn)
						}))
					}
				/>
				<ThresholdSection
					value={draft.threshold}
					onChange={(threshold) => setDraft((current) => ({ ...current, threshold }))}
				/>
				<SuggestionsCard data={suggestions} />
			</ReadOnlyFieldset>
			{view.isReadOnly && (
				<p className="text-text-muted mt-5 text-sm">
					{tSandbox('settingsFixed')}{' '}
					<Link
						href="/sign-up"
						className="text-text decoration-border-strong hover:decoration-text underline underline-offset-[3px]"
					>
						{tSandbox('setYourOwn')}
					</Link>
				</p>
			)}

			<ActionBar
				back={{ href: `${view.base}/vendors`, label: t('back') }}
				hint={
					view.isReadOnly ? undefined : error != null ? (
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

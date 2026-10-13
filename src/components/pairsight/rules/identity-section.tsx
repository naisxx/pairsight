'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowCounterClockwiseIcon, ShieldIcon } from '@/components/ui/icons'
import { OptionSelect, type SelectOption } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/entity-types'
import type { IdentityRole } from '@/server/pairsight/fields'
import type { GuessSignal } from '@/server/pairsight/profile/country-guess'
import { useEvaluationView } from '../evaluation-context'
import { RulesCard } from './rules-card'

const NOTE_ICON_SIZE = 15

// Where the records looked to be from (profile/country-guess.ts), and what
// that was read from.
export type CountryGuessHint = { code: string; from: GuessSignal[] }

// Puts a box back to the record type's own wording; the save that follows
// can be undone like any other.
function UseSuggested({ onClick }: { onClick: () => void }) {
	const t = useTranslations('Rules')
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-accent-ink type-ui hit-area inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
		>
			<ArrowCounterClockwiseIcon size={12} />
			{t('useSuggested')}
		</button>
	)
}

// What counts as the same individual (Jev's yes/no criteria), and the
// country that frames names, addresses and phone numbers.
export function IdentitySection({
	same,
	different,
	country,
	countries,
	countryGuess,
	suggested,
	onChange,
	className
}: {
	same: string
	different: string
	country: string
	countries: SelectOption[]
	// Said under the country while it's still the one set from the file.
	countryGuess: CountryGuessHint | null
	// The record type's own wording: each box offers to go back to it.
	suggested: { same: string; different: string }
	onChange: (patch: Partial<{ same: string; different: string; country: string }>) => void
	className?: string
}) {
	const t = useTranslations('Rules')
	const tRecords = useTranslations('Records')
	const format = useFormatter()
	const isSameEmpty = same.trim() === ''
	const isDifferentEmpty = different.trim() === ''
	const view = useEvaluationView()
	const countryName = countries.find((option) => option.value === country)?.label ?? country
	const box =
		'bg-bg text-text-body mt-1.5 min-h-[72px] resize-none px-4 py-3.5 text-base leading-relaxed field-sizing-content'
	return (
		<RulesCard
			id="identity"
			letter={t('letter.identity')}
			title={t('identityTitle')}
			description={t('identityDescription')}
			className={className}
		>
			<div className="flex min-h-7 items-center justify-between gap-2">
				<label htmlFor="identity-same" className="font-semibold">
					{t('identitySame')}
				</label>
				{same.trim() !== suggested.same.trim() && (
					<UseSuggested onClick={() => onChange({ same: suggested.same })} />
				)}
			</div>
			<Textarea
				id="identity-same"
				className={box}
				value={same}
				aria-invalid={isSameEmpty}
				aria-describedby={isSameEmpty ? 'identity-same-error' : undefined}
				onChange={(event) => onChange({ same: event.target.value })}
			/>
			{isSameEmpty && (
				<p id="identity-same-error" className="text-danger mt-1 text-sm">
					{t('sameRequired')}
				</p>
			)}
			<div className="mt-5 flex min-h-7 items-center justify-between gap-2">
				<label htmlFor="identity-different" className="font-semibold">
					{t('identityDifferent')}
				</label>
				{different.trim() !== suggested.different.trim() && (
					<UseSuggested onClick={() => onChange({ different: suggested.different })} />
				)}
			</div>
			<Textarea
				id="identity-different"
				className={box}
				value={different}
				aria-invalid={isDifferentEmpty}
				aria-describedby={isDifferentEmpty ? 'identity-different-error' : undefined}
				onChange={(event) => onChange({ different: event.target.value })}
			/>
			{isDifferentEmpty && (
				<p id="identity-different-error" className="text-danger mt-1 text-sm">
					{t('differentRequired')}
				</p>
			)}
			{view.isReadOnly ? (
				<p className="text-text-muted mt-4 text-sm">
					{t.rich('countryFrom', {
						country: countryName,
						b: (chunks) => <strong className="text-text font-semibold">{chunks}</strong>
					})}
				</p>
			) : (
				<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
					<label htmlFor="identity-country" className="font-semibold">
						{t('country')}
					</label>
					<OptionSelect
						id="identity-country"
						className="w-auto min-w-[220px] flex-1 @3xl:max-w-[320px] @3xl:flex-none"
						value={country}
						options={countries}
						onValueChange={(value) => onChange({ country: value })}
					/>
					<p className="text-text-muted basis-full text-sm">
						{countryGuess != null && countryGuess.code === country && (
							<>
								{t('countryGuessed', {
									from: format.list(
										countryGuess.from.map((signal) => tRecords(`healthCountryFrom.${signal}`))
									)
								})}{' '}
							</>
						)}
						{t('countryHint')}
					</p>
				</div>
			)}
		</RulesCard>
	)
}

// The mapped fields Jev is sent. Nothing else about the records reaches it.
export function JevFieldsSection({
	mappedRoles,
	jevFields,
	idColumn,
	onToggle,
	className
}: {
	mappedRoles: IdentityRole[]
	jevFields: ReadonlySet<IdentityRole>
	// The record ID's column: shown, never sent.
	idColumn: string
	onToggle: (role: IdentityRole, isOn: boolean) => void
	className?: string
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const tooFewFields = jevFields.size < MIN_JEV_FIELDS
	return (
		<RulesCard
			id="jev-fields"
			letter={t('letter.fields')}
			title={t('jevFieldsTitle')}
			description={t('jevFieldsHint')}
			className={className}
			footer={
				<>
					<ShieldIcon size={NOTE_ICON_SIZE} className="shrink-0" />
					{t('neverSent')}
				</>
			}
		>
			<fieldset>
				<legend className="sr-only">{t('jevFieldsLegend')}</legend>
				<div className="flex flex-wrap gap-2">
					{mappedRoles.map((role) => (
						<label
							key={role}
							className="border-border bg-surface has-[[data-state=unchecked]]:text-text-muted flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border pr-3.5 pl-2.5 text-[0.9375rem] transition-colors duration-150 has-[:disabled]:cursor-default"
						>
							<Checkbox
								className="data-[state=checked]:bg-cat-pairsight-subtle data-[state=checked]:text-cat-pairsight size-[22px] rounded-[6px] disabled:opacity-100 data-[state=checked]:border-transparent"
								checked={jevFields.has(role)}
								onCheckedChange={(checked) => onToggle(role, checked === true)}
							/>
							{tRoles(role)}
						</label>
					))}
					<span className="border-border text-text-muted flex min-h-11 items-center rounded-sm border border-dashed px-3.5 text-[0.9375rem]">
						{t('recordIdNeverSent', { column: idColumn })}
					</span>
				</div>
				{tooFewFields && <p className="text-danger mt-2 text-sm">{t('jevFieldsMin')}</p>}
			</fieldset>
		</RulesCard>
	)
}

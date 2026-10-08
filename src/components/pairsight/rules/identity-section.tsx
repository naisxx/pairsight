'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowCounterClockwiseIcon, ShieldIcon } from '@/components/ui/icons'
import { OptionSelect, type SelectOption } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/entity-types'
import type { IdentityRole } from '@/server/pairsight/fields'
import { RulesCard } from './rules-card'

const NOTE_ICON_SIZE = 15

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
	suggested,
	onChange,
	className
}: {
	same: string
	different: string
	country: string
	countries: SelectOption[]
	// The record type's own wording: each box offers to go back to it.
	suggested: { same: string; different: string }
	onChange: (patch: Partial<{ same: string; different: string; country: string }>) => void
	className?: string
}) {
	const t = useTranslations('Rules')
	const isSameEmpty = same.trim() === ''
	const isDifferentEmpty = different.trim() === ''
	return (
		<RulesCard
			id="identity"
			eyebrow={t('identityEyebrow')}
			title={t('identityTitle')}
			description={t('identityDescription')}
			className={className}
		>
			<div className="grid flex-1 gap-4 @3xl:grid-cols-2">
				<div className="flex flex-col">
					<div className="flex min-h-7 items-center justify-between gap-2">
						<label htmlFor="identity-same" className="type-ui font-medium">
							{t('identitySame')}
						</label>
						{same.trim() !== suggested.same.trim() && (
							<UseSuggested onClick={() => onChange({ same: suggested.same })} />
						)}
					</div>
					<Textarea
						id="identity-same"
						className="mt-1 min-h-[112px] flex-1"
						value={same}
						aria-invalid={isSameEmpty}
						aria-describedby={isSameEmpty ? 'identity-same-error' : undefined}
						onChange={(event) => onChange({ same: event.target.value })}
					/>
					{isSameEmpty && (
						<p id="identity-same-error" className="text-danger mt-1 text-xs">
							{t('sameRequired')}
						</p>
					)}
				</div>
				<div className="flex flex-col">
					<div className="flex min-h-7 items-center justify-between gap-2">
						<label htmlFor="identity-different" className="type-ui font-medium">
							{t('identityDifferent')}
						</label>
						{different.trim() !== suggested.different.trim() && (
							<UseSuggested onClick={() => onChange({ different: suggested.different })} />
						)}
					</div>
					<Textarea
						id="identity-different"
						className="mt-1 min-h-[112px] flex-1"
						value={different}
						aria-invalid={isDifferentEmpty}
						aria-describedby={isDifferentEmpty ? 'identity-different-error' : undefined}
						onChange={(event) => onChange({ different: event.target.value })}
					/>
					{isDifferentEmpty && (
						<p id="identity-different-error" className="text-danger mt-1 text-xs">
							{t('differentRequired')}
						</p>
					)}
				</div>
			</div>
			<div className="border-border mt-5 grid gap-x-4 gap-y-1.5 border-t pt-4 @3xl:grid-cols-2 @3xl:items-center">
				<div>
					<label htmlFor="identity-country" className="type-ui font-medium">
						{t('country')}
					</label>
					<p className="text-text-muted text-xs">{t('countryHint')}</p>
				</div>
				<OptionSelect
					id="identity-country"
					value={country}
					options={countries}
					onValueChange={(value) => onChange({ country: value })}
				/>
			</div>
		</RulesCard>
	)
}

// The mapped fields Jev is sent. Nothing else about the records reaches it.
export function JevFieldsSection({
	mappedRoles,
	jevFields,
	onToggle,
	className
}: {
	mappedRoles: IdentityRole[]
	jevFields: ReadonlySet<IdentityRole>
	onToggle: (role: IdentityRole, isOn: boolean) => void
	className?: string
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const tooFewFields = jevFields.size < MIN_JEV_FIELDS
	return (
		<RulesCard
			id="jev-fields"
			eyebrow={t('jevFieldsEyebrow')}
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
				{/* As many columns as fit; a name too long for its box ends in an ellipsis. */}
				<div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
					{mappedRoles.map((role) => (
						<label
							key={role}
							// A long name is cut short with an ellipsis; hovering shows it whole.
							title={tRoles(role)}
							className="type-ui border-border bg-surface-muted has-[[data-state=checked]]:border-border-input has-[[data-state=checked]]:bg-surface-elevated flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 whitespace-nowrap transition-colors duration-150"
						>
							<Checkbox
								checked={jevFields.has(role)}
								onCheckedChange={(checked) => onToggle(role, checked === true)}
							/>
							<span className="min-w-0 truncate">{tRoles(role)}</span>
						</label>
					))}
				</div>
				{tooFewFields && <p className="text-danger mt-2 text-xs">{t('jevFieldsMin')}</p>}
			</fieldset>
		</RulesCard>
	)
}

'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { ShieldIcon } from '@/components/ui/icons'
import { OptionSelect, type SelectOption } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/custom-rules'
import type { IdentityRole } from '@/server/pairsight/fields'

const NOTE_ICON_SIZE = 15

// What counts as the same individual (Jev's yes/no criteria), the country
// that frames names, addresses and phone numbers, and the mapped fields Jev
// is sent. Nothing else about the records reaches Jev.
export function IdentitySection({
	same,
	different,
	country,
	countries,
	mappedRoles,
	jevFields,
	onChange
}: {
	same: string
	different: string
	country: string
	countries: SelectOption[]
	mappedRoles: IdentityRole[]
	jevFields: ReadonlySet<IdentityRole>
	onChange: (
		patch: Partial<{ same: string; different: string; country: string }> & {
			field?: { role: IdentityRole; isOn: boolean }
		}
	) => void
}) {
	const t = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const isSameEmpty = same.trim() === ''
	const isDifferentEmpty = different.trim() === ''
	const tooFewFields = jevFields.size < MIN_JEV_FIELDS
	return (
		<section
			aria-labelledby="identity-title"
			className="border-border bg-surface rounded-md border"
		>
			<header className="px-5 pt-4 pb-2">
				<p className="text-accent-ink text-xs font-medium">{t('identityEyebrow')}</p>
				<h2 id="identity-title" className="mt-0.5 text-base font-semibold">
					{t('identityTitle')}
				</h2>
				<p className="type-ui text-text-muted mt-1">{t('identityDescription')}</p>
			</header>
			<div className="grid gap-4 px-5 pt-2 pb-5 @3xl:grid-cols-2">
				<div>
					<label htmlFor="identity-same" className="type-ui font-medium">
						{t('identitySame')}
					</label>
					<Textarea
						id="identity-same"
						className="mt-1.5 min-h-[104px]"
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
				<div>
					<label htmlFor="identity-different" className="type-ui font-medium">
						{t('identityDifferent')}
					</label>
					<Textarea
						id="identity-different"
						className="mt-1.5 min-h-[104px]"
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
				<div>
					<label htmlFor="identity-country" className="type-ui font-medium">
						{t('country')}
					</label>
					<p className="text-text-muted text-xs">{t('countryHint')}</p>
					<OptionSelect
						id="identity-country"
						className="mt-1.5"
						value={country}
						options={countries}
						onValueChange={(value) => onChange({ country: value })}
					/>
				</div>
				<fieldset>
					<legend className="type-ui font-medium">{t('jevFieldsLegend')}</legend>
					<p className="text-text-muted text-xs">{t('jevFieldsHint')}</p>
					{/* As many columns as fit, so a field name never breaks over two lines. */}
					<div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-2">
						{mappedRoles.map((role) => (
							<label key={role} className="type-ui flex items-center gap-2 whitespace-nowrap">
								<Checkbox
									checked={jevFields.has(role)}
									onCheckedChange={(checked) =>
										onChange({ field: { role, isOn: checked === true } })
									}
								/>
								{tRoles(role)}
							</label>
						))}
					</div>
					{tooFewFields && <p className="text-danger mt-2 text-xs">{t('jevFieldsMin')}</p>}
				</fieldset>
			</div>
			<p className="border-border text-text-muted flex items-center gap-2 border-t px-5 py-3 text-xs">
				<ShieldIcon size={NOTE_ICON_SIZE} className="shrink-0" />
				{t('neverSent')}
			</p>
		</section>
	)
}

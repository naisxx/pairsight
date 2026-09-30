'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Section } from '../step-layout'

// What counts as the same individual (sent to Jev as its yes/no criteria),
// and the country used to read local phone numbers.
export function IdentitySection({
	same,
	different,
	country,
	onSameChange,
	onDifferentChange,
	onCountryChange
}: {
	same: string
	different: string
	country: string
	onSameChange: (value: string) => void
	onDifferentChange: (value: string) => void
	onCountryChange: (value: string) => void
}) {
	const t = useTranslations('Rules')
	const id = useId()
	return (
		<Section title={t('identityTitle')}>
			<div className="grid gap-4 lg:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${id}-same`}>{t('identitySame')}</Label>
					<Textarea
						id={`${id}-same`}
						value={same}
						onChange={(event) => onSameChange(event.target.value)}
						rows={4}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${id}-different`}>{t('identityDifferent')}</Label>
					<Textarea
						id={`${id}-different`}
						value={different}
						onChange={(event) => onDifferentChange(event.target.value)}
						rows={4}
					/>
				</div>
			</div>
			<div className="mt-4 flex max-w-xs flex-col gap-1.5">
				<Label htmlFor={`${id}-country`}>{t('country')}</Label>
				<Input
					id={`${id}-country`}
					value={country}
					onChange={(event) => onCountryChange(event.target.value.toUpperCase().slice(0, 2))}
					maxLength={2}
					className="w-20 font-mono uppercase"
					aria-describedby={`${id}-country-hint`}
				/>
				<p id={`${id}-country-hint`} className="text-text-muted text-xs">
					{t('countryHint')}
				</p>
			</div>
		</Section>
	)
}

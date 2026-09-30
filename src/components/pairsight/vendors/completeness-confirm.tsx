'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/ui/checkbox'
import { InfoIcon } from '@/components/ui/icons'

// The required confirmation that an export lists every match the vendor
// made — the assumption behind treating an omitted pair as "not matched".
export function CompletenessConfirm({
	isConfirmed,
	onChange
}: {
	isConfirmed: boolean
	onChange: (isConfirmed: boolean) => void
}) {
	const t = useTranslations('Vendors')
	return (
		<div className="border-info/30 bg-info-subtle flex flex-col gap-3 rounded-lg border p-4">
			<p className="text-text flex items-center gap-2 text-sm font-semibold">
				<InfoIcon className="text-info" />
				{t('completeTitle')}
			</p>
			<p className="text-text text-sm">{t('completeExplanation')}</p>
			<label className="text-text flex items-center gap-2.5 text-sm font-medium">
				<Checkbox checked={isConfirmed} onCheckedChange={(checked) => onChange(checked === true)} />
				{t('completeConfirm')}
			</label>
		</div>
	)
}

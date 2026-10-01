'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, SpinnerIcon } from '@/components/ui/icons'

// The preset stats are computed on the server with the saved country, so a
// country edit changes phone keys the cards don't reflect yet. Say so, and
// offer a save that recounts without leaving the page.
export function UnsavedCountryNotice({
	savedCountry,
	isSaving,
	onSave
}: {
	savedCountry: string
	isSaving: boolean
	onSave: () => void
}) {
	const t = useTranslations('Rules')
	return (
		<div
			role="status"
			className="border-warning/40 bg-warning-subtle flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2"
		>
			<p className="text-text type-body flex flex-1 items-start gap-2">
				<AlertIcon className="text-warning mt-0.5 shrink-0" />
				{t('countryUnsaved', { country: savedCountry })}
			</p>
			<Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
				{isSaving && <SpinnerIcon />}
				{isSaving ? t('saving') : t('saveAndRecount')}
			</Button>
		</div>
	)
}

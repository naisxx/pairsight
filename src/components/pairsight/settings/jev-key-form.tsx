'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon, TrashIcon, WarningCircleIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import {
	removeJevConnectionAction,
	saveJevConnectionAction
} from '@/server/actions/pairsight/settings'

const ICON_SIZE = 16
const LABEL_CLASS_NAME = 'mb-1.5 block text-sm font-semibold'

// An admin's way to set the Jev key: paste it (and, rarely, another address),
// and it's checked with Jev before it's saved. The field is cleared after,
// and the key is never shown again. Remove goes back to this server's own key.
export function JevKeyForm({ baseUrl, hasSaved }: { baseUrl: string; hasSaved: boolean }) {
	const t = useTranslations('Settings')
	const id = useId()
	const router = useRouter()
	const [apiKey, setApiKey] = useState('')
	const [address, setAddress] = useState(baseUrl)
	const [error, setError] = useState<string | null>(null)
	const [isSaving, startSaving] = useTransition()
	const [isRemoving, startRemoving] = useTransition()

	return (
		<form
			noValidate
			className="mt-6 flex flex-col"
			onSubmit={(event) => {
				event.preventDefault()
				setError(null)
				if (apiKey.trim() === '') {
					setError(t('keyRequired'))
					return
				}
				startSaving(async () => {
					const result = await saveJevConnectionAction({ apiKey, baseUrl: address })
					if (!result.ok) {
						setError(result.error)
						return
					}
					setApiKey('')
					toast({ title: t('savedToast') })
					router.refresh()
				})
			}}
		>
			{error != null && (
				<div
					role="alert"
					className="bg-danger-subtle text-danger type-ui mb-4 flex gap-2 rounded-sm p-3"
				>
					<WarningCircleIcon size={ICON_SIZE} className="mt-px shrink-0" />
					{error}
				</div>
			)}
			<label htmlFor={`${id}-key`} className={LABEL_CLASS_NAME}>
				{hasSaved ? t('keyReplaceLabel') : t('keyLabel')}
			</label>
			<Input
				id={`${id}-key`}
				type="password"
				autoComplete="off"
				spellCheck={false}
				value={apiKey}
				onChange={(event) => setApiKey(event.target.value)}
				aria-describedby={`${id}-key-hint`}
			/>
			<p id={`${id}-key-hint`} className="text-text-muted mt-1.5 text-sm">
				{t('keyHint')}
			</p>

			<label htmlFor={`${id}-address`} className={`${LABEL_CLASS_NAME} mt-5`}>
				{t('addressLabel')}
			</label>
			<Input
				id={`${id}-address`}
				type="url"
				spellCheck={false}
				value={address}
				onChange={(event) => setAddress(event.target.value)}
				aria-describedby={`${id}-address-hint`}
				className="font-mono"
			/>
			<p id={`${id}-address-hint`} className="text-text-muted mt-1.5 text-sm">
				{t('addressHint')}
			</p>

			<div className="mt-6 flex flex-wrap items-center gap-3">
				<Button type="submit" disabled={isSaving || isRemoving}>
					{isSaving && <SpinnerIcon size={ICON_SIZE} />}
					{isSaving ? t('checking') : t('checkAndSave')}
				</Button>
				{hasSaved && (
					<Button
						type="button"
						variant="secondary"
						disabled={isSaving || isRemoving}
						onClick={() =>
							startRemoving(async () => {
								setError(null)
								const result = await removeJevConnectionAction({})
								if (!result.ok) {
									setError(result.error)
									return
								}
								toast({ title: t('removedToast') })
								router.refresh()
							})
						}
					>
						<TrashIcon size={ICON_SIZE} />
						{t('remove')}
					</Button>
				)}
			</div>
		</form>
	)
}

'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SpinnerIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'

// Naming an evaluation, new or existing. `onSubmit` returns an error message
// to show, or null once it's done (it may also navigate away).
export function NameDialog({
	open,
	onOpenChange,
	title,
	description,
	initialName = '',
	submitLabel,
	pendingLabel,
	takenNames,
	onSubmit
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	initialName?: string
	submitLabel: string
	pendingLabel: string
	// The owner's other evaluation names, for an instant duplicate check; the
	// server checks again.
	takenNames: string[]
	onSubmit: (name: string) => Promise<string | null>
}) {
	const t = useTranslations('Evaluations')
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			closeLabel={t('close')}
			width="sm"
		>
			<NameForm
				initialName={initialName}
				submitLabel={submitLabel}
				pendingLabel={pendingLabel}
				takenNames={takenNames}
				onCancel={() => onOpenChange(false)}
				onSubmit={onSubmit}
			/>
		</Dialog>
	)
}

// The dialog's body. Radix unmounts it on close, so each opening starts fresh.
function NameForm({
	initialName,
	submitLabel,
	pendingLabel,
	takenNames,
	onCancel,
	onSubmit
}: {
	initialName: string
	submitLabel: string
	pendingLabel: string
	takenNames: string[]
	onCancel: () => void
	onSubmit: (name: string) => Promise<string | null>
}) {
	const t = useTranslations('Evaluations')
	const id = useId()
	const [name, setName] = useState(initialName)
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [serverError, setServerError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const trimmed = name.trim()
	const localError =
		trimmed === ''
			? t('nameRequired')
			: trimmed.length > NAME_MAX_LENGTH
				? t('nameTooLong', { max: NAME_MAX_LENGTH })
				: takenNames.some((taken) => taken.toLowerCase() === trimmed.toLowerCase())
					? t('nameTaken')
					: null
	const error = localError ?? serverError
	const showError = isSubmitted && error != null

	return (
		<form
			noValidate
			onSubmit={(event) => {
				event.preventDefault()
				setIsSubmitted(true)
				if (localError != null) return
				setServerError(null)
				startTransition(async () => {
					setServerError(await onSubmit(trimmed))
				})
			}}
		>
			<label htmlFor={`${id}-name`} className="type-ui font-medium">
				{t('nameLabel')}
			</label>
			<Input
				id={`${id}-name`}
				autoFocus
				className="mt-1.5"
				value={name}
				placeholder={t('namePlaceholder')}
				onChange={(event) => {
					setName(event.target.value)
					setServerError(null)
				}}
				aria-invalid={showError}
				aria-describedby={showError ? `${id}-error` : undefined}
			/>
			{showError && (
				<p id={`${id}-error`} className="text-danger mt-1.5 text-xs">
					{error}
				</p>
			)}
			<div className="mt-5 flex justify-end gap-2 pb-2">
				<Button variant="secondary" onClick={onCancel}>
					{t('cancel')}
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending && <SpinnerIcon />}
					{isPending ? pendingLabel : submitLabel}
				</Button>
			</div>
		</form>
	)
}

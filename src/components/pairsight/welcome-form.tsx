'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { SpinnerIcon, WarningCircleIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { FULL_NAME_MAX_LENGTH, fullNameSchema } from '@/lib/auth/profile'
import { saveProfile } from '@/server/actions/auth'

// Onboarding's one question. The name is checked once you first submit, then
// as you type, and again by the action. Never on blur: leaving an empty field
// isn't a mistake yet.
export function WelcomeForm({ next }: { next?: string }) {
	const t = useTranslations('Welcome')
	const id = useId()
	const [name, setName] = useState('')
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const fieldError = fullNameSchema.safeParse(name).success ? null : t('nameRequired')
	const showFieldError = isSubmitted && fieldError != null

	return (
		<form
			noValidate
			className="border-border bg-surface mt-7 rounded-md border p-5"
			onSubmit={(event) => {
				event.preventDefault()
				setIsSubmitted(true)
				setFormError(null)
				if (fieldError != null) return
				startTransition(async () => {
					const result = await saveProfile({ name, next })
					if (!result.ok) setFormError(result.error)
				})
			}}
		>
			{formError != null && (
				<div
					role="alert"
					className="bg-danger-subtle text-danger type-ui mb-4 flex gap-2 rounded-sm p-3"
				>
					<WarningCircleIcon className="mt-px shrink-0" />
					{formError}
				</div>
			)}
			<label htmlFor={`${id}-name`} className="type-ui font-medium">
				{t('nameLabel')}
			</label>
			<Input
				id={`${id}-name`}
				autoComplete="name"
				autoFocus
				maxLength={FULL_NAME_MAX_LENGTH}
				className="mt-1.5"
				value={name}
				onChange={(event) => setName(event.target.value)}
				aria-invalid={showFieldError}
				aria-describedby={`${id}-${showFieldError ? 'error' : 'hint'}`}
			/>
			{showFieldError ? (
				<p id={`${id}-error`} className="text-danger mt-1.5 text-xs">
					{fieldError}
				</p>
			) : (
				<p id={`${id}-hint`} className="text-text-muted mt-1.5 text-xs">
					{t('nameHint')}
				</p>
			)}
			<Button type="submit" className="mt-5 w-full" disabled={isPending}>
				{isPending && <SpinnerIcon />}
				{t('continue')}
			</Button>
		</form>
	)
}

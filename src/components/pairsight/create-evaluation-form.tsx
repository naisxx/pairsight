'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, PlusIcon, SpinnerIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { createEvaluationAction } from '@/server/actions/pairsight/evaluations'

export function CreateEvaluationForm() {
	const t = useTranslations('Evaluations')
	const id = useId()
	const [error, setError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()

	function submit(formData: FormData) {
		setError(null)
		startTransition(async () => {
			const result = await createEvaluationAction({ name: String(formData.get('name') ?? '') })
			if (!result.ok) setError(result.error)
		})
	}

	return (
		<form action={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
			<div className="flex flex-1 flex-col gap-1.5">
				<Label htmlFor={`${id}-name`}>{t('nameLabel')}</Label>
				<Input
					id={`${id}-name`}
					name="name"
					required
					maxLength={NAME_MAX_LENGTH}
					placeholder={t('namePlaceholder')}
				/>
			</div>
			<Button type="submit" disabled={isPending}>
				{isPending ? <SpinnerIcon /> : <PlusIcon />}
				{isPending ? t('creating') : t('create')}
			</Button>
			{error != null && (
				<p role="alert" className="text-danger type-body flex items-center gap-1.5 sm:basis-full">
					<AlertIcon />
					{error}
				</p>
			)}
		</form>
	)
}

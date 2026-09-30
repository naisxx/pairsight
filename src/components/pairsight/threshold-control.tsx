'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateThresholdAction } from '@/server/actions/pairsight/runs'

const STEP = 0.01

// Re-decides from saved scores; Jev is never called again (docs/PairSight-V1-Scope.md,
// "Runs and reuse"). The distribution chart joins this control in M3.
export function ThresholdControl({ runId, threshold }: { runId: string; threshold: number }) {
	const t = useTranslations('Results')
	const router = useRouter()
	const id = useId()
	const [value, setValue] = useState(threshold.toFixed(2))
	const [error, setError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const parsed = Number(value)
	const isValid = value !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1

	return (
		<form
			className="flex flex-wrap items-end gap-2"
			onSubmit={(event) => {
				event.preventDefault()
				if (!isValid) return
				startTransition(async () => {
					setError(null)
					const result = await updateThresholdAction({ runId, threshold: parsed })
					if (!result.ok) setError(result.error)
					else router.refresh()
				})
			}}
		>
			<div className="flex flex-col gap-1">
				<Label htmlFor={`${id}-threshold`} className="text-xs">
					{t('thresholdLabel')}
				</Label>
				<Input
					id={`${id}-threshold`}
					type="number"
					min={0}
					max={1}
					step={STEP}
					value={value}
					onChange={(event) => setValue(event.target.value)}
					className="h-8 w-24 font-mono tabular-nums"
					aria-describedby={`${id}-threshold-help`}
					aria-invalid={!isValid}
				/>
			</div>
			<Button
				type="submit"
				size="sm"
				variant="outline"
				disabled={!isValid || isPending || parsed === threshold}
			>
				{isPending && <SpinnerIcon />}
				{t('thresholdApply')}
			</Button>
			<p id={`${id}-threshold-help`} className="text-text-muted basis-full text-xs">
				{t('thresholdHelp')}
			</p>
			{error != null && (
				<p role="alert" className="text-danger basis-full text-xs">
					{error}
				</p>
			)}
		</form>
	)
}

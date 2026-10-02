'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, PlayIcon, SpinnerIcon } from '@/components/ui/icons'
import { startRunAction } from '@/server/actions/pairsight/runs'
import { useEvaluationView } from './evaluation-context'
import { useRunsCentre } from './runs/runs-centre'

// Starts a run and hands it to the Runs centre, which opens on it, drives it
// and takes you to its results when it's done.
export function StartRunButton({
	evaluationId,
	isDisabled
}: {
	evaluationId: string
	isDisabled: boolean
}) {
	const t = useTranslations('Plan')
	const [error, setError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const view = useEvaluationView()
	const { track } = useRunsCentre()
	return (
		<>
			{error != null && (
				<p role="alert" className="text-danger type-body mr-auto flex items-center gap-1.5">
					<AlertIcon />
					{error}
				</p>
			)}
			<Button
				disabled={isDisabled || isPending}
				onClick={() =>
					startTransition(async () => {
						setError(null)
						const result = await startRunAction({ evaluationId })
						if (!result.ok) {
							setError(result.error)
							return
						}
						const { runId } = result.data
						track(runId, { resultsHref: `${view.base}/runs/${runId}/results` })
					})
				}
			>
				{isPending ? <SpinnerIcon /> : <PlayIcon />}
				{isPending ? t('starting') : t('start')}
			</Button>
		</>
	)
}

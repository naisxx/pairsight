'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertIcon, ArrowRightIcon, SpinnerIcon } from '@/components/ui/icons'
import { startRunAction } from '@/server/actions/pairsight/runs'
import { useEvaluationView } from './evaluation-context'
import { useRunsCentre } from './runs/runs-centre'

// Past this many pairs, getting a run ready takes long enough (about 25 s
// at 100K, docs/PairSight-Scale-Roadmap.md item 8) to say what's happening.
const MANY_PAIRS = 10_000

// Starts a run and hands it to the Runs centre, which opens on it, drives it
// and takes you to its results when it's done.
export function StartRunButton({
	evaluationId,
	pairCount,
	isDisabled,
	describedBy
}: {
	evaluationId: string
	pairCount: number
	isDisabled: boolean
	// The id of what says why it can't start yet.
	describedBy?: string
}) {
	const t = useTranslations('Plan')
	const [error, setError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	const view = useEvaluationView()
	const { track } = useRunsCentre()
	return (
		<>
			{error != null && (
				<p role="alert" className="type-body flex basis-full items-center gap-1.5">
					<AlertIcon />
					{error}
				</p>
			)}
			<Button
				disabled={isDisabled || isPending}
				aria-describedby={describedBy}
				className="min-h-13"
				cap={isPending ? <SpinnerIcon /> : <ArrowRightIcon />}
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
				{!isPending
					? t('start')
					: pairCount > MANY_PAIRS
						? t('startingMany', { count: pairCount })
						: t('starting')}
			</Button>
		</>
	)
}

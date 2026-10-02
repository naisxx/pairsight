'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@/i18n/routing'
import type { ActionResult } from '@/server/actions/validated-action'
import {
	advanceRunAction,
	resumeRunAction,
	retryFailedAction
} from '@/server/actions/pairsight/runs'
import type { RunProgress } from '@/server/pairsight/runs'
import { useIsReadOnly } from '../evaluation-context'

const PAUSE_BETWEEN_BATCHES_MS = 250
const RETRY_AFTER_ERROR_MS = 3_000

async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
	const settled = await result
	if (!settled.ok) throw new Error(settled.error)
	return settled.data
}

// Drives a run while its page is open (docs/PairSight-Delivery-Plan.md, "Run
// execution"): each successful advance schedules the next batch; a failed call
// waits and tries again. Leaving the page stops scheduling, which pauses the
// run until someone comes back. Every number shown comes from the backend.
// In the read-only sandbox it shows the prepared run and never advances it.
export function useRunLoop({ runId, initial }: { runId: string; initial: RunProgress }) {
	const router = useRouter()
	const isReadOnly = useIsReadOnly()
	const [progress, setProgress] = useState(initial)
	const isRunning = progress.status === 'running' && !isReadOnly

	const advance = useMutation({
		mutationFn: () => unwrap(advanceRunAction({ runId })),
		onSuccess: (next) => {
			setProgress(next)
			if (next.status !== 'running') router.refresh()
		}
	})

	const restart = () =>
		setProgress((current) => ({ ...current, status: 'running', stopReason: null }))
	const retry = useMutation({
		mutationFn: () => unwrap(retryFailedAction({ runId })),
		onSuccess: restart
	})
	const resume = useMutation({
		mutationFn: () => unwrap(resumeRunAction({ runId })),
		onSuccess: restart
	})

	const { mutate, isPending, isError, submittedAt } = advance
	useEffect(() => {
		if (!isRunning || isPending) return
		const delay = isError ? RETRY_AFTER_ERROR_MS : submittedAt === 0 ? 0 : PAUSE_BETWEEN_BATCHES_MS
		const timer = setTimeout(() => mutate(), delay)
		return () => clearTimeout(timer)
	}, [isRunning, isPending, isError, submittedAt, mutate])

	return {
		progress,
		hasTransientError: isRunning && isError,
		retryFailed: () => retry.mutate(),
		resume: () => resume.mutate(),
		isActing: retry.isPending || resume.isPending
	}
}

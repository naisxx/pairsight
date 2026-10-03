'use client'

import { createContext, use, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { RUNS_PARAM } from '@/lib/pairsight/evaluation-view'
import { toast } from '@/lib/toast'
import { advanceRunAction, listRunsAction } from '@/server/actions/pairsight/runs'
import type { ActionResult } from '@/server/actions/validated-action'
import type { RunProgress } from '@/server/pairsight/runs'
import type { RunCard } from '@/server/pairsight/run-centre'
import { RunsDialog } from './runs-dialog'

const PAUSE_BETWEEN_BATCHES_MS = 250
const RETRY_AFTER_ERROR_MS = 3_000

export type RunsTab = 'active' | 'completed'

async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
	const settled = await result
	if (!settled.ok) throw new Error(settled.error)
	return settled.data
}

type RunsCentre = {
	isSandbox: boolean
	activeCount: number
	open: (options?: { tab?: RunsTab; focusRunId?: string }) => void
	// A run just started (or resumed, or retried): drive it, and when it was
	// started here, take the viewer to its results once it's done.
	track: (runId: string, options?: { resultsHref?: string }) => void
}

const RunsCentreContext = createContext<RunsCentre | null>(null)

export function useRunsCentre(): RunsCentre {
	const centre = use(RunsCentreContext)
	if (centre == null) throw new Error('useRunsCentre needs a RunsCentreProvider')
	return centre
}

// Drives one run (docs/PairSight-Delivery-Plan.md, "Run execution"): each
// successful advance schedules the next batch; a failed call waits and tries
// again. It lives in the shell, so the run keeps going on any page; closing
// the app pauses it until someone comes back. Every number is the backend's.
function RunDriver({
	runId,
	onProgress,
	onSettled
}: {
	runId: string
	onProgress: (runId: string, progress: RunProgress) => void
	onSettled: (runId: string, progress: RunProgress) => void
}) {
	const advance = useMutation({
		mutationFn: () => unwrap(advanceRunAction({ runId })),
		onSuccess: (next) => {
			onProgress(runId, next)
			if (next.status !== 'running') onSettled(runId, next)
		}
	})
	const { mutate, isPending, isError, submittedAt, data } = advance
	const isRunning = data == null || data.status === 'running'
	useEffect(() => {
		if (!isRunning || isPending) return
		const delay = isError ? RETRY_AFTER_ERROR_MS : submittedAt === 0 ? 0 : PAUSE_BETWEEN_BATCHES_MS
		const timer = setTimeout(() => mutate(), delay)
		return () => clearTimeout(timer)
	}, [isRunning, isPending, isError, submittedAt, mutate])
	return null
}

// The Runs centre's state, for the whole shell: whether the dialog is open
// and on which tab, the cards, and a driver for every run still going. The
// sandbox only shows its prepared run; nothing there is ever driven.
export function RunsCentreProvider({
	isSandbox,
	initialActiveIds,
	children
}: {
	isSandbox: boolean
	initialActiveIds: string[]
	children: React.ReactNode
}) {
	const t = useTranslations('Runs')
	const router = useRouter()
	const queryClient = useQueryClient()
	const searchParams = useSearchParams()
	const linkedRunId = searchParams.get(RUNS_PARAM)
	const [isOpen, setIsOpen] = useState(linkedRunId != null)
	const [tab, setTab] = useState<RunsTab | null>(null)
	const [focusRunId, setFocusRunId] = useState<string | null>(linkedRunId)
	const [activeIds, setActiveIds] = useState<ReadonlySet<string>>(
		() => new Set(isSandbox ? [] : initialActiveIds)
	)
	const [followed, setFollowed] = useState<{ runId: string; resultsHref: string } | null>(null)
	// What a driver last reported, and when: newer than the list, it's what
	// the card shows; once the list is fetched again, the list wins.
	const [live, setLive] = useState<ReadonlyMap<string, { progress: RunProgress; at: number }>>(
		new Map()
	)

	const runs = useQuery({
		queryKey: ['runs', isSandbox],
		queryFn: () => unwrap(listRunsAction({ sandbox: isSandbox })),
		enabled: isOpen
	})
	// Opening always shows the runs as they are now: a pair retried on Results
	// since the last look changes its run's counts.
	const { refetch } = runs
	useEffect(() => {
		if (isOpen) void refetch()
	}, [isOpen, refetch])
	const cards: RunCard[] | null =
		runs.data?.map((card) => {
			const latest = live.get(card.id)
			return latest == null || latest.at < runs.dataUpdatedAt
				? card
				: { ...card, status: latest.progress.status, progress: latest.progress }
		}) ?? null
	const shownTab: RunsTab = tab ?? (activeIds.size > 0 ? 'active' : 'completed')

	function open(options?: { tab?: RunsTab; focusRunId?: string }) {
		setTab(options?.tab ?? null)
		setFocusRunId(options?.focusRunId ?? null)
		setIsOpen(true)
	}

	function onProgress(runId: string, progress: RunProgress) {
		setLive((current) => new Map(current).set(runId, { progress, at: Date.now() }))
	}

	function onSettled(runId: string, progress: RunProgress) {
		setActiveIds((current) => {
			const next = new Set(current)
			next.delete(runId)
			return next
		})
		void queryClient.invalidateQueries({ queryKey: ['runs'] })
		const isFollowed = followed?.runId === runId
		if (isFollowed) setFollowed(null)
		if (isOpen) {
			setTab('completed')
			setFocusRunId(runId)
			if (isFollowed && progress.status === 'completed') router.push(followed.resultsHref)
		}
		// After the push, never before: a navigation discards a refresh still
		// in flight, which left the shared layout (the header's status) on
		// "Running". Queued behind it, the refresh runs once the push lands.
		router.refresh()
		if (isOpen) return
		if (isFollowed || progress.status === 'completed') {
			toast({
				title: progress.status === 'completed' ? t('doneTitle') : t('stoppedToast'),
				action:
					followed != null && isFollowed
						? {
								label: t('viewResults'),
								onClick: () => router.push(followed.resultsHref)
							}
						: { label: t('openRuns'), onClick: () => open({ tab: 'completed', focusRunId: runId }) }
			})
		}
	}

	function track(runId: string, options?: { resultsHref?: string }) {
		if (isSandbox) return
		setActiveIds((current) => new Set(current).add(runId))
		setLive((current) => {
			const next = new Map(current)
			next.delete(runId)
			return next
		})
		if (options?.resultsHref != null) setFollowed({ runId, resultsHref: options.resultsHref })
		void queryClient.invalidateQueries({ queryKey: ['runs'] })
		open({ tab: 'active', focusRunId: runId })
	}

	const centre: RunsCentre = { isSandbox, activeCount: activeIds.size, open, track }
	return (
		<RunsCentreContext value={centre}>
			{children}
			{[...activeIds].map((runId) => (
				<RunDriver key={runId} runId={runId} onProgress={onProgress} onSettled={onSettled} />
			))}
			<RunsDialog
				open={isOpen}
				onOpenChange={setIsOpen}
				tab={shownTab}
				onTabChange={setTab}
				cards={cards}
				isLoading={runs.isPending}
				hasError={runs.isError}
				focusRunId={focusRunId}
				activeIds={activeIds}
			/>
		</RunsCentreContext>
	)
}

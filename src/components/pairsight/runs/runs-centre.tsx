'use client'

import { createContext, use, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/routing'
import { RUNS_PARAM } from '@/lib/pairsight/evaluation-view'
import { toast } from '@/lib/toast'
import { listRunsAction, runProgressAction } from '@/server/actions/pairsight/runs'
import type { ActionResult } from '@/server/actions/validated-action'
import type { RunProgress } from '@/server/pairsight/runs'
import type { RunCard } from '@/server/pairsight/run-centre'
import { RunsDialog } from './runs-dialog'

// How often a watched run's progress is read, and how often the runs list
// refreshes while anything runs (to notice runs started in another tab).
const PROGRESS_POLL_MS = 1_000
const LIST_POLL_MS = 3_000
// Why a run stopped when someone paused it (src/server/pairsight/runs.ts).
const PAUSED = 'paused'

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
	// A run just started (or resumed, or retried): follow it, and when it was
	// started here, take the viewer to its results once it's done.
	track: (runId: string, options?: { resultsHref?: string }) => void
}

const RunsCentreContext = createContext<RunsCentre | null>(null)

export function useRunsCentre(): RunsCentre {
	const centre = use(RunsCentreContext)
	if (centre == null) throw new Error('useRunsCentre needs a RunsCentreProvider')
	return centre
}

// Follows one run (docs/PairSight-Delivery-Plan.md, "Run execution"). The
// background worker on the server does the work; this only reads how far it
// has got, every second, until the run stops running. Every number is the
// backend's.
function RunWatcher({
	runId,
	onProgress,
	onSettled
}: {
	runId: string
	onProgress: (runId: string, progress: RunProgress) => void
	onSettled: (runId: string, progress: RunProgress) => void
}) {
	useQuery({
		queryKey: ['run-progress', runId],
		queryFn: async () => {
			const progress = await unwrap(runProgressAction({ runId }))
			onProgress(runId, progress)
			if (progress.status !== 'running') onSettled(runId, progress)
			return progress
		},
		refetchInterval: (query) =>
			query.state.data == null || query.state.data.status === 'running' ? PROGRESS_POLL_MS : false,
		refetchIntervalInBackground: true,
		gcTime: 0
	})
	return null
}

// The Runs centre's state, for the whole shell: whether the dialog is open
// and on which tab, the cards, and a watcher for every run still going. The
// sandbox only shows its prepared run; nothing there is ever watched.
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
	// Runs this page has seen finish: a list fetched a moment earlier may still
	// say they're running, and they shouldn't be followed again.
	const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(new Set())
	const [followed, setFollowed] = useState<{ runId: string; resultsHref: string } | null>(null)
	// What a driver last reported, and when: newer than the list, it's what
	// the card shows; once the list is fetched again, the list wins.
	const [live, setLive] = useState<ReadonlyMap<string, { progress: RunProgress; at: number }>>(
		new Map()
	)

	const isWatching = !isSandbox && (activeIds.size > 0 || isOpen)
	const runs = useQuery({
		queryKey: ['runs', isSandbox],
		queryFn: () => unwrap(listRunsAction({ sandbox: isSandbox })),
		enabled: isOpen || isWatching,
		refetchInterval: isWatching ? LIST_POLL_MS : false
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
				: {
						...card,
						status: latest.progress.status,
						completedAt: latest.progress.completedAt,
						progress: latest.progress
					}
		}) ?? null
	// Every run to follow: those started or resumed here, plus any the list
	// shows running that this page hasn't seen finish (another tab started it).
	const watchedIds: ReadonlySet<string> = isSandbox
		? new Set()
		: new Set([
				...activeIds,
				...(runs.data ?? [])
					.filter((card) => card.status === 'running' && !settledIds.has(card.id))
					.map((card) => card.id)
			])
	const shownTab: RunsTab = tab ?? (watchedIds.size > 0 ? 'active' : 'completed')

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
		setSettledIds((current) => new Set(current).add(runId))
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
		if (isFollowed || progress.status === 'completed' || progress.stopReason === PAUSED) {
			toast({
				title:
					progress.status === 'completed'
						? t('doneTitle')
						: progress.stopReason === PAUSED
							? t('pausedToast')
							: t('stoppedToast'),
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
		setSettledIds((current) => {
			const next = new Set(current)
			next.delete(runId)
			return next
		})
		setLive((current) => {
			const next = new Map(current)
			next.delete(runId)
			return next
		})
		if (options?.resultsHref != null) setFollowed({ runId, resultsHref: options.resultsHref })
		void queryClient.invalidateQueries({ queryKey: ['runs'] })
		open({ tab: 'active', focusRunId: runId })
	}

	const centre: RunsCentre = { isSandbox, activeCount: watchedIds.size, open, track }
	return (
		<RunsCentreContext value={centre}>
			{children}
			{[...watchedIds].map((runId) => (
				<RunWatcher key={runId} runId={runId} onProgress={onProgress} onSettled={onSettled} />
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
				activeIds={watchedIds}
			/>
		</RunsCentreContext>
	)
}

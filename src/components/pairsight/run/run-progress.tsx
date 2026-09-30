'use client'

import { useTranslations } from 'next-intl'
import { AlertIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'
import { Progress } from '@/components/ui/progress'
import type { RunProgress as Progress_ } from '@/server/pairsight/runs'
import { RunActions } from './run-actions'
import { useRunLoop } from './use-run-loop'

// The run screen: backend counts, the live status line, the stop banner and
// the actions. The loop itself lives in useRunLoop.
export function RunProgress({
	runId,
	resultsHref,
	initial
}: {
	runId: string
	resultsHref: string
	initial: Progress_
}) {
	const t = useTranslations('Run')
	const { progress, hasTransientError, retryFailed, resume, isActing } = useRunLoop({
		runId,
		initial
	})
	const done = progress.succeeded + progress.failed
	const percent = progress.total === 0 ? 0 : Math.round((done / progress.total) * 100)
	const counts: Array<[string, number]> = [
		[t('succeeded'), progress.succeeded],
		[t('failed'), progress.failed],
		[t('running'), progress.running],
		[t('pending'), progress.pending]
	]

	return (
		<div className="flex flex-col gap-6">
			<div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-5">
				<div className="flex items-baseline justify-between gap-4">
					<p className="text-text text-sm font-medium tabular-nums">
						{t('progress', { done, total: progress.total })}
					</p>
					<p className="text-text-muted text-sm tabular-nums">{percent}%</p>
				</div>
				<Progress value={percent} aria-label={t('progress', { done, total: progress.total })} />
				<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{counts.map(([label, value]) => (
						<div key={label} className="bg-surface-muted rounded px-3 py-2">
							<dt className="text-text-muted text-xs">{label}</dt>
							<dd className="text-text text-lg font-semibold tabular-nums">{value}</dd>
						</div>
					))}
				</dl>
			</div>

			<div aria-live="polite">
				{progress.status === 'running' && (
					<p className="text-text-muted flex items-center gap-2 text-sm">
						{hasTransientError ? <AlertIcon className="text-warning" /> : <SpinnerIcon />}
						{hasTransientError ? t('errorUnknown') : t('keepOpen')}
					</p>
				)}
				{progress.status === 'completed' && (
					<p className="text-text flex items-start gap-2 text-sm">
						<SuccessIcon className="text-success mt-0.5 shrink-0" />
						{progress.failed > 0
							? t('completeWithFailures', { count: progress.failed })
							: t('complete')}
					</p>
				)}
			</div>

			{progress.status === 'stopped' && (
				<div role="alert" className="border-danger/40 bg-danger-subtle rounded-lg border p-4">
					<p className="text-danger flex items-center gap-2 text-sm font-semibold">
						<AlertIcon />
						{t('stoppedTitle')}
					</p>
					<p className="text-text mt-1 text-sm">
						{progress.stopReason === 'invalid_key' ? t('invalid_key') : t('missing_key')}
					</p>
				</div>
			)}

			<RunActions
				progress={progress}
				resultsHref={resultsHref}
				isActing={isActing}
				onRetryFailed={retryFailed}
				onResume={resume}
			/>
		</div>
	)
}

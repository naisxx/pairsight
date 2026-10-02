'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
	AlertIcon,
	FailedIcon,
	InfoIcon,
	RetryIcon,
	SpinnerIcon,
	SuccessIcon,
	WarningCircleIcon
} from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { RunProgress as RunProgressData } from '@/server/pairsight/runs'
import { RunActions } from './run-actions'
import { RunElapsed } from './run-elapsed'
import { useRunLoop } from './use-run-loop'
import { ReadOnlyGate } from '../read-only'

// The run screen: the state, backend counts and why pairs failed in one card,
// the stop alert above it when the run stopped, and the action bar. The loop
// itself lives in useRunLoop.

// Screen readers hear progress at each quarter, not on every batch.
const MILESTONE_PERCENT = 25
const FULL_PERCENT = 100
const STATE_ICON_SIZE = 18
const NOTE_ICON_SIZE = 15
const ALERT_ICON_SIZE = 20
const INCOMPLETE_ICON_SIZE = 16
const RETRY_ICON_SIZE = 14

export function RunProgress({
	runId,
	resultsHref,
	backHref,
	initial,
	startedAt,
	completedAt
}: {
	runId: string
	resultsHref: string
	backHref: string
	initial: RunProgressData
	startedAt: Date
	completedAt: Date | null
}) {
	const t = useTranslations('Run')
	const tFailures = useTranslations('Failures')
	const format = useFormatter()
	const { progress, hasTransientError, retryFailed, resume, isActing } = useRunLoop({
		runId,
		initial
	})
	const { status } = progress
	const done = progress.succeeded + progress.failed
	const percent = progress.total === 0 ? 0 : (done / progress.total) * FULL_PERCENT
	const milestone = Math.floor(percent / MILESTONE_PERCENT) * MILESTONE_PERCENT
	const counts = [
		{ label: t('succeeded'), value: progress.succeeded, dot: 'bg-text' },
		{ label: t('running'), value: progress.running, dot: 'bg-info' },
		{ label: t('pending'), value: progress.pending, dot: 'bg-border-input' },
		{ label: t('failed'), value: progress.failed, dot: 'bg-danger' }
	]
	const showIncomplete = status === 'completed' && progress.failed > 0

	return (
		<>
			{status === 'stopped' && (
				<section role="alert" className="border-danger bg-surface max-w-4xl rounded-md border p-5">
					<h2 className="text-danger flex items-center gap-2 text-base font-semibold">
						<FailedIcon size={ALERT_ICON_SIZE} />
						{t('stoppedTitle')}
					</h2>
					<p className="type-ui text-text mt-2">
						{progress.stopReason === 'invalid_key' ? t('invalid_key') : t('missing_key')}{' '}
						{t('stoppedNote')}
					</p>
					<ol className="type-ui text-text-muted mt-3 list-decimal space-y-1 pl-5">
						<li>{t('fixStepKey')}</li>
						<li>{t('fixStepRestart')}</li>
						<li>{t('fixStepResume')}</li>
					</ol>
					{progress.stopReason != null && (
						<p className="text-text-muted mt-3 font-mono text-xs">
							{t('errorCode', { code: progress.stopReason })}
						</p>
					)}
				</section>
			)}

			<section
				aria-labelledby="run-title"
				className={cn(
					'border-border bg-surface max-w-4xl rounded-md border',
					status === 'stopped' && 'mt-4'
				)}
			>
				<div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
					<div>
						<h2 id="run-title" className="flex items-center gap-2 text-base font-semibold">
							{status === 'running' && (
								<SpinnerIcon size={STATE_ICON_SIZE} className="text-text-muted" />
							)}
							{status === 'completed' &&
								(showIncomplete ? (
									<AlertIcon size={STATE_ICON_SIZE} variant="solid" className="text-warning" />
								) : (
									<SuccessIcon size={STATE_ICON_SIZE} variant="solid" className="text-success" />
								))}
							{status === 'stopped' && (
								<AlertIcon size={STATE_ICON_SIZE} variant="solid" className="text-warning" />
							)}
							{status === 'running'
								? t('stateRunning')
								: status === 'completed'
									? showIncomplete
										? t('stateIncomplete', { count: progress.failed })
										: t('stateComplete')
									: t('stateStopped')}
						</h2>
						<p aria-live="polite" className="type-ui text-text-muted mt-1">
							{status === 'running' &&
								(hasTransientError ? (
									<span className="text-warning flex items-center gap-1.5">
										<AlertIcon />
										{t('errorUnknown')}
									</span>
								) : (
									t('metaRunning')
								))}
							{status === 'completed' &&
								completedAt != null &&
								t('metaComplete', {
									when: format.dateTime(completedAt, { dateStyle: 'medium', timeStyle: 'short' })
								})}
							{status === 'stopped' && t('metaStopped')}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<RunElapsed startedAt={startedAt} completedAt={completedAt} />
						{showIncomplete && (
							<Chip tone="outline" className="border-border-input border-dashed">
								{t('incompleteChip', { count: progress.failed })}
							</Chip>
						)}
					</div>
				</div>

				<div className="px-5 pt-4">
					<div className="type-ui flex items-baseline justify-between">
						<span className="text-text-muted">{t('progressLabel')}</span>
						<span className="font-mono">{t('progressValue', { done, total: progress.total })}</span>
					</div>
					<div
						role="progressbar"
						aria-label={t('progressAria')}
						aria-valuenow={done}
						aria-valuemin={0}
						aria-valuemax={progress.total}
						className="bg-border mt-2 h-2 overflow-hidden rounded-full"
					>
						<div
							className={cn(
								'h-full rounded-full transition-[width] duration-150 ease-out',
								status === 'stopped' ? 'bg-border-input' : 'bg-action'
							)}
							style={{ width: `${percent}%` }}
						/>
					</div>
					<p aria-live="polite" className="sr-only">
						{status === 'running' && milestone > 0 && milestone < FULL_PERCENT
							? t('milestone', { percent: milestone })
							: ''}
					</p>
				</div>

				<dl className="border-border @2xl:divide-border mt-4 grid grid-cols-2 border-t @2xl:grid-cols-4 @2xl:divide-x">
					{counts.map((count) => (
						<div key={count.label} className="border-border border-b px-5 py-3 @2xl:border-b-0">
							<dt className="text-text-muted flex items-center gap-1.5 text-xs">
								<span aria-hidden className={cn('size-2 rounded-full', count.dot)} />
								{count.label}
							</dt>
							<dd className="mt-1 font-mono text-[22px] leading-none font-medium">{count.value}</dd>
						</div>
					))}
				</dl>

				{progress.failures.length > 0 && (
					<div className="border-border border-t px-5 py-4">
						{showIncomplete && (
							<p className="type-ui mb-3 flex items-start gap-2">
								<WarningCircleIcon
									size={INCOMPLETE_ICON_SIZE}
									className="text-text-muted mt-px shrink-0"
								/>
								<span>
									<span className="font-medium">
										{t('incompleteTitle', { count: progress.failed })}
									</span>{' '}
									<span className="text-text-muted">{t('incompleteBody')}</span>
								</span>
							</p>
						)}
						<div className={showIncomplete ? 'pl-6' : undefined}>
							<h3 className="type-ui font-medium">{t('failuresTitle')}</h3>
							<ul className="mt-1.5 flex max-w-md flex-col gap-1">
								{progress.failures.map(({ reason, count }) => (
									<li key={reason} className="type-ui flex items-baseline gap-2">
										<span className="text-text-muted">{tFailures(reason)}</span>
										<span className="font-mono text-xs">· {t('failureCount', { count })}</span>
									</li>
								))}
							</ul>
							{showIncomplete && (
								<div className="mt-3">
									<ReadOnlyGate action="retry">
										<Button size="sm" onClick={retryFailed} disabled={isActing}>
											{isActing ? (
												<SpinnerIcon size={RETRY_ICON_SIZE} />
											) : (
												<RetryIcon size={RETRY_ICON_SIZE} />
											)}
											{isActing ? t('retrying') : t('retryFailed', { count: progress.failed })}
										</Button>
									</ReadOnlyGate>
								</div>
							)}
						</div>
					</div>
				)}
			</section>

			<ul className="type-ui text-text-muted mt-4 max-w-4xl space-y-2">
				{/* Only a running run is paused by leaving; a finished one has nothing left. */}
				{status === 'running' && (
					<li className="flex items-start gap-2">
						<InfoIcon size={NOTE_ICON_SIZE} className="mt-0.5 shrink-0" />
						{t('noteLeave')}
					</li>
				)}
				<li className="flex items-start gap-2">
					<InfoIcon size={NOTE_ICON_SIZE} className="mt-0.5 shrink-0" />
					{t('noteIncomplete')}
				</li>
			</ul>

			<RunActions
				progress={progress}
				resultsHref={resultsHref}
				backHref={backHref}
				isActing={isActing}
				onResume={resume}
			/>
		</>
	)
}

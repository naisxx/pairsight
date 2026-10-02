'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
	AlertIcon,
	ArrowRightIcon,
	ChevronDownIcon,
	FailedIcon,
	PlayIcon,
	RetryIcon,
	SpinnerIcon,
	SuccessIcon
} from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { thresholdPreset } from '@/lib/pairsight/decisions'
import { resumeRunAction, retryFailedAction } from '@/server/actions/pairsight/runs'
import type { ActionResult } from '@/server/actions/validated-action'
import type { RunCard as RunCardData } from '@/server/pairsight/run-centre'
import { ReadOnlyGate } from '../read-only'
import { ruleLabel } from '../rule-label'
import { RunElapsed } from './run-elapsed'
import { useRunsCentre } from './runs-centre'

const ICON_SIZE = 15
const PERCENT = 100

async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
	const settled = await result
	if (!settled.ok) throw new Error(settled.error)
	return settled.data
}

type Look = 'running' | 'complete' | 'incomplete' | 'stopped'

function lookOf(card: RunCardData): Look {
	if (card.status === 'running') return 'running'
	if (card.status === 'stopped') return 'stopped'
	return card.progress.failed > 0 ? 'incomplete' : 'complete'
}

// One run in the Runs centre. The front answers "which run, how far, did it
// work, what now"; Details shows everything it was run with — its frozen
// settings, so exactly what produced its results.
export function RunCard({ card, isFocused }: { card: RunCardData; isFocused: boolean }) {
	const t = useTranslations('Runs')
	const tRun = useTranslations('Run')
	const tRules = useTranslations('Rules')
	const tRoles = useTranslations('Roles')
	const tFailures = useTranslations('Failures')
	const format = useFormatter()
	const { track } = useRunsCentre()
	const [isExpanded, setIsExpanded] = useState(isFocused)
	const look = lookOf(card)
	const { progress } = card
	const done = progress.succeeded + progress.failed
	const percent = progress.total === 0 ? 0 : (done / progress.total) * PERCENT
	const preset = thresholdPreset(card.threshold)
	const thresholdName = preset == null ? tRules('thresholdCustom') : tRules(`threshold_${preset}`)
	const when = (date: Date) => format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' })

	const restart = { onSuccess: () => track(card.id) }
	const retry = useMutation({
		mutationFn: () => unwrap(retryFailedAction({ runId: card.id })),
		...restart
	})
	const resume = useMutation({
		mutationFn: () => unwrap(resumeRunAction({ runId: card.id })),
		...restart
	})
	const actionError = retry.error ?? resume.error

	return (
		<article
			aria-labelledby={`run-${card.id}`}
			className={cn(
				'bg-surface rounded-md border',
				look === 'stopped' ? 'border-danger' : 'border-border',
				isFocused && look !== 'stopped' && 'border-border-input'
			)}
		>
			<div className="flex flex-wrap items-start justify-between gap-3 p-4">
				<div className="min-w-0">
					<h3 id={`run-${card.id}`} className="flex items-center gap-2 text-sm font-semibold">
						{look === 'running' && <SpinnerIcon size={ICON_SIZE} className="text-info" />}
						{look === 'complete' && (
							<SuccessIcon size={ICON_SIZE} variant="solid" className="text-success" />
						)}
						{look === 'incomplete' && (
							<AlertIcon size={ICON_SIZE} variant="solid" className="text-warning" />
						)}
						{look === 'stopped' && <FailedIcon size={ICON_SIZE} className="text-danger" />}
						{t('runOf', { number: card.number, evaluation: card.evaluation.name })}
					</h3>
					<p className="type-ui text-text-muted mt-0.5">
						{look === 'running'
							? t('stateRunning')
							: look === 'complete'
								? t('stateComplete')
								: look === 'incomplete'
									? t('stateIncomplete', { count: progress.failed })
									: t('stateStopped')}
						{' · '}
						{t('startedAt', { when: when(card.createdAt) })}
					</p>
				</div>
				<RunElapsed startedAt={card.createdAt} completedAt={card.completedAt} />
			</div>

			{look === 'running' ? (
				<div className="px-4 pb-3">
					<div className="type-ui flex justify-between">
						<span className="text-text-muted">{t('judged')}</span>
						<span className="font-mono">
							{done} / {progress.total}
						</span>
					</div>
					<div
						role="progressbar"
						aria-label={t('progressAria', { number: card.number })}
						aria-valuenow={done}
						aria-valuemin={0}
						aria-valuemax={progress.total}
						className="bg-border mt-1.5 h-1.5 overflow-hidden rounded-full"
					>
						<div
							className="bg-action h-full rounded-full transition-[width] duration-300 ease-out"
							style={{ width: `${percent}%` }}
						/>
					</div>
				</div>
			) : (
				<ul className="flex flex-wrap gap-1.5 px-4 pb-3">
					<li>
						<Chip tone="outline">{t('pairs', { count: progress.total })}</Chip>
					</li>
					<li>
						<Chip tone="outline">
							{t('thresholdChip', { value: card.threshold.toFixed(2), name: thresholdName })}
						</Chip>
					</li>
					{progress.failed > 0 && (
						<li>
							<Chip tone="outline" className="border-border-input border-dashed">
								{t('incomplete', { count: progress.failed })}
							</Chip>
						</li>
					)}
				</ul>
			)}

			{look === 'stopped' && (
				<div role="alert" className="border-danger/40 mx-4 mb-3 rounded-sm border px-3 py-2">
					<p className="type-ui text-danger font-medium">
						{card.stopReason === 'invalid_key' ? tRun('invalid_key') : tRun('missing_key')}
					</p>
					<p className="text-text-muted mt-0.5 text-xs">{t('stoppedFix')}</p>
				</div>
			)}

			<div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
				<Button
					variant="quiet"
					size="sm"
					aria-expanded={isExpanded}
					aria-controls={`run-details-${card.id}`}
					onClick={() => setIsExpanded((current) => !current)}
				>
					<ChevronDownIcon
						size={14}
						className={cn('transition-transform duration-150', isExpanded && 'rotate-180')}
					/>
					{isExpanded ? t('hideDetails') : t('showDetails')}
				</Button>
				<div className="flex flex-wrap items-center gap-2">
					{actionError != null && (
						<p role="alert" className="text-danger text-xs">
							{actionError.message}
						</p>
					)}
					{look === 'stopped' && (
						<ReadOnlyGate action="run">
							<Button size="sm" onClick={() => resume.mutate()} disabled={resume.isPending}>
								{resume.isPending ? <SpinnerIcon /> : <PlayIcon size={ICON_SIZE} />}
								{t('resume')}
							</Button>
						</ReadOnlyGate>
					)}
					{look === 'incomplete' && (
						<ReadOnlyGate action="retry">
							<Button
								variant="secondary"
								size="sm"
								onClick={() => retry.mutate()}
								disabled={retry.isPending}
							>
								{retry.isPending ? <SpinnerIcon /> : <RetryIcon size={ICON_SIZE} />}
								{t('retryFailed', { count: progress.failed })}
							</Button>
						</ReadOnlyGate>
					)}
					{look !== 'stopped' && look !== 'running' && (
						<Button size="sm" asChild>
							<Link href={card.resultsHref}>
								{t('viewResults')}
								<ArrowRightIcon size={ICON_SIZE} />
							</Link>
						</Button>
					)}
				</div>
			</div>

			{/* Details open by easing their height (0fr → 1fr) rather than popping in;
			    closed, they stay in the page but inert, so focus never lands in them. */}
			<div
				id={`run-details-${card.id}`}
				inert={!isExpanded}
				className={cn(
					'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
					isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
				)}
			>
				<div className="min-h-0 overflow-hidden">
					<dl className="border-border grid grid-cols-1 gap-x-6 gap-y-3 border-t p-4 text-xs sm:grid-cols-[10rem_1fr]">
						<dt className="text-text-muted">{t('detailThreshold')}</dt>
						<dd>
							<span className="font-mono">{card.threshold.toFixed(2)}</span> · {thresholdName}
						</dd>
						<dt className="text-text-muted">{t('detailJudgments')}</dt>
						<dd>
							{t('judgmentsLine', {
								total: progress.total,
								reused: card.reused,
								fresh: Math.max(0, progress.succeeded - card.reused),
								failed: progress.failed
							})}
						</dd>
						{progress.failures.length > 0 && (
							<>
								<dt className="text-text-muted">{t('detailFailures')}</dt>
								<dd>
									{progress.failures
										.map(({ reason, count }) => `${tFailures(reason)} · ${count}`)
										.join(', ')}
								</dd>
							</>
						)}
						<dt className="text-text-muted">{t('detailModel')}</dt>
						<dd className="font-mono">{card.model}</dd>
						<dt className="text-text-muted">{t('detailVendors')}</dt>
						<dd>
							<ul className="space-y-0.5">
								{card.settings.vendors.map((vendor) => (
									<li key={`${vendor.name}-${vendor.fileName}`}>
										{vendor.name} · <span className="font-mono">{vendor.fileName}</span> ·{' '}
										{vendor.format === 'pair' ? t('formatPair') : t('formatGroup')}
									</li>
								))}
							</ul>
						</dd>
						<dt className="text-text-muted">{t('detailRules')}</dt>
						<dd>
							{card.settings.rules
								.map((rule) =>
									ruleLabel({ ruleId: rule.id, rules: card.settings.rules, tRules, tRoles })
								)
								.join(', ')}
						</dd>
						<dt className="text-text-muted">{t('detailFields')}</dt>
						<dd>{card.settings.jevFields.map((field) => tRoles(field)).join(', ')}</dd>
						<dt className="text-text-muted">{t('detailCountry')}</dt>
						<dd className="font-mono">{card.settings.countryCode}</dd>
						<dt className="text-text-muted">{t('detailSame')}</dt>
						<dd className="whitespace-pre-line">{card.settings.identitySame}</dd>
						<dt className="text-text-muted">{t('detailDifferent')}</dt>
						<dd className="whitespace-pre-line">{card.settings.identityDifferent}</dd>
						<dt className="text-text-muted">{t('detailTimes')}</dt>
						<dd>
							{t('startedAt', { when: when(card.createdAt) })}
							{card.completedAt != null && (
								<> · {t('finishedAt', { when: when(card.completedAt) })}</>
							)}
						</dd>
						<dt className="text-text-muted">{t('detailId')}</dt>
						<dd className="font-mono break-all">{card.id}</dd>
					</dl>
				</div>
			</div>
		</article>
	)
}

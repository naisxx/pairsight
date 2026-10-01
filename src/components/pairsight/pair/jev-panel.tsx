import { useFormatter, useTranslations } from 'next-intl'
import { AiIcon, WarningCircleIcon } from '@/components/ui/icons'
import { failureReason } from '@/lib/pairsight/failure-reasons'
import { cn } from '@/lib/cn'
import type { AssessmentStatus } from '@/server/pairsight/decisions'
import { RetryPairButton } from './retry-pair-button'

const PERCENT = 100

// Jev's judgment of this pair: the score against the threshold, the model and
// when — or, when there isn't one yet or it failed, that state explicitly,
// with a retry for a failure (never a "no match").
export function JevPanel({
	runId,
	pairId,
	status,
	score,
	errorCode,
	modelReported,
	fallbackModel,
	completedAt,
	threshold
}: {
	runId: string
	pairId: string
	status: AssessmentStatus
	score: number | null
	errorCode: string | null
	modelReported: string | null
	fallbackModel: string
	completedAt: Date | null
	threshold: number
}) {
	const t = useTranslations('Pair')
	const tFailures = useTranslations('Failures')
	const format = useFormatter()
	const title = (
		<h2 id="jev-title" className="type-subheading flex items-center gap-2">
			<AiIcon className="text-text-muted" />
			{t('jevTitle')}
		</h2>
	)

	if (status !== 'succeeded' || score == null) {
		const isFailed = status === 'failed'
		return (
			<section
				aria-labelledby="jev-title"
				className="border-border-input bg-surface rounded-md border border-dashed p-4"
			>
				{title}
				<p className="type-ui mt-3 flex items-center gap-2 font-medium">
					<WarningCircleIcon className={isFailed ? 'text-danger' : 'text-text-muted'} />
					{isFailed ? t('assessmentFailed') : t('assessmentPending')}
				</p>
				{isFailed && (
					<p className="text-text-muted type-ui mt-1" title={errorCode ?? undefined}>
						{tFailures(failureReason(errorCode))}
					</p>
				)}
				<p className="text-text-muted mt-2 text-xs">{t('incompleteNote')}</p>
				{isFailed && (
					<div className="mt-3">
						<RetryPairButton runId={runId} pairId={pairId} />
					</div>
				)}
			</section>
		)
	}

	const isMatch = score >= threshold
	return (
		<section aria-labelledby="jev-title" className="border-border bg-surface rounded-md border p-4">
			<div className="flex items-start justify-between gap-3">
				{title}
				<span className={cn('type-ui font-medium', isMatch ? 'text-text' : 'text-text-muted')}>
					{isMatch ? t('match') : t('noMatch')}
				</span>
			</div>
			<div className="mt-3 flex items-end gap-3">
				<span className="font-mono text-[32px] leading-none font-medium">{score.toFixed(2)}</span>
				<span className="text-text-muted pb-1 text-xs">
					{t.rich(isMatch ? 'atOrAboveThreshold' : 'belowThreshold', {
						value: threshold.toFixed(2),
						n: (chunks) => <span className="text-text font-mono">{chunks}</span>
					})}
				</span>
			</div>
			<div
				role="img"
				aria-label={t('scoreBarLabel', {
					score: score.toFixed(2),
					threshold: threshold.toFixed(2)
				})}
				className="bg-surface-muted relative mt-3 h-2 rounded-full"
			>
				<div
					className={cn(
						'absolute inset-y-0 left-0 rounded-full',
						isMatch ? 'bg-text' : 'bg-border-input'
					)}
					style={{ width: `${score * PERCENT}%` }}
				/>
				<div
					className="bg-ring absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full"
					style={{ left: `${threshold * PERCENT}%` }}
				/>
			</div>
			<div className="text-text-muted mt-1 flex justify-between font-mono text-[0.6875rem]">
				<span>0</span>
				<span>1</span>
			</div>
			<dl className="mt-3 grid grid-cols-[80px_1fr] gap-y-1 text-xs">
				<dt className="text-text-muted">{t('model')}</dt>
				<dd className="font-mono">{modelReported ?? fallbackModel}</dd>
				<dt className="text-text-muted">{t('assessed')}</dt>
				<dd>
					{completedAt == null
						? '—'
						: format.dateTime(completedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</dd>
			</dl>
			<p className="border-border text-text-muted mt-3 border-t pt-3 text-xs leading-relaxed">
				{t('aiNote')}
			</p>
		</section>
	)
}

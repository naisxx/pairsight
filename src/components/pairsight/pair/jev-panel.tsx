import { useFormatter, useTranslations } from 'next-intl'
import { WarningCircleIcon } from '@/components/ui/icons'
import { failureReason } from '@/lib/pairsight/failure-reasons'
import type { AssessmentStatus } from '@/server/pairsight/decisions'
import { ReadOnlyGate } from '../read-only'
import { RetryPairButton } from './retry-pair-button'

const PERCENT = 100
const SCORE_DIGITS = 2

// What Jev says about this pair (pairsight-handoff Pair): its call against the
// cut-off in a sentence, the score as a mark on a 0 to 1 track with the
// cut-off ticked, that Jev can be wrong, and which version checked it when.
// When there's no score yet, or Jev couldn't give one, it says so, with a
// retry for a failure (never "different").
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
	const card = 'bg-surface border-border rounded-lg border p-6 md:p-7'
	const title = (
		<h2 id="jev-title" className="text-text-muted type-eyebrow">
			{t('jevTitle')}
		</h2>
	)

	if (status !== 'succeeded' || score == null) {
		const isFailed = status === 'failed'
		return (
			<section aria-labelledby="jev-title" className={card}>
				{title}
				<p className="mt-3 flex items-center gap-2 text-base font-medium">
					<WarningCircleIcon className={isFailed ? 'text-danger' : 'text-text-muted'} />
					{isFailed ? t('assessmentFailed') : t('assessmentPending')}
				</p>
				{isFailed && (
					<p className="text-text-muted mt-1 text-sm" title={errorCode ?? undefined}>
						{tFailures(failureReason(errorCode))}
					</p>
				)}
				<p className="text-text-muted mt-3 text-sm">{t('incompleteNote')}</p>
				{isFailed && (
					<div className="mt-3">
						<ReadOnlyGate action="retry">
							<RetryPairButton runId={runId} pairId={pairId} />
						</ReadOnlyGate>
					</div>
				)}
			</section>
		)
	}

	const isMatch = score >= threshold
	const cutoff = threshold.toFixed(SCORE_DIGITS)
	return (
		<section aria-labelledby="jev-title" className={card}>
			{title}
			<p className="text-text-body mt-3 text-base">
				{t.rich(isMatch ? 'jevSame' : 'jevDifferent', {
					value: cutoff,
					b: (chunks) => <strong className="text-text font-semibold">{chunks}</strong>,
					n: (chunks) => <span className="font-mono">{chunks}</span>
				})}
			</p>
			<div
				role="img"
				aria-label={t('scoreBarLabel', { score: score.toFixed(SCORE_DIGITS), threshold: cutoff })}
				className="mt-7"
			>
				<div className="bg-border relative h-2.5 rounded-full">
					<span
						aria-hidden
						className="bg-text-muted absolute -top-1.5 h-[22px] w-0.5"
						style={{ left: `${threshold * PERCENT}%` }}
					/>
					<span
						aria-hidden
						className="bg-brand absolute -top-2 -ml-[3px] h-[26px] w-1.5 rounded-[3px]"
						style={{ left: `${score * PERCENT}%` }}
					/>
				</div>
				<div aria-hidden className="text-text-muted relative mt-2.5 h-5 font-mono text-sm">
					<span className="absolute left-0">0</span>
					<span className="absolute -translate-x-1/2" style={{ left: `${threshold * PERCENT}%` }}>
						{cutoff}
					</span>
					<span className="absolute right-0">1</span>
				</div>
			</div>
			<p className="text-text-muted mt-4 text-sm">{t('aiNote')}</p>
			<p className="border-border text-text-muted mt-3 border-t pt-3 font-mono text-sm">
				{t('jevMeta', {
					model: modelReported ?? fallbackModel,
					date:
						completedAt == null
							? '—'
							: format.dateTime(completedAt, { dateStyle: 'medium', timeStyle: 'short' })
				})}
			</p>
		</section>
	)
}

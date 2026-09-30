import { useFormatter, useTranslations } from 'next-intl'
import { AlertIcon, InfoIcon } from '@/components/ui/icons'
import type { AssessmentStatus } from '@/server/pairsight/decisions'
import { ScoreBar, StatusChip } from '../result-parts'

// Jev's judgment of this pair — or, when there isn't one yet or it failed,
// that state explicitly (never a "no match").
export function JevPanel({
	status,
	score,
	errorCode,
	modelReported,
	fallbackModel,
	completedAt,
	threshold,
	decision
}: {
	status: AssessmentStatus
	score: number | null
	errorCode: string | null
	modelReported: string | null
	fallbackModel: string
	completedAt: Date | null
	threshold: number
	decision: string
}) {
	const t = useTranslations('Pair')
	const format = useFormatter()
	return (
		<section className="border-border bg-surface rounded-lg border p-4">
			<h2 className="text-text mb-3 text-sm font-semibold">{t('jevTitle')}</h2>
			{status === 'succeeded' && score != null ? (
				<div className="flex flex-col gap-2">
					<ScoreBar score={score} threshold={threshold} size="lg" />
					<p className="text-text-muted text-xs tabular-nums">
						{t('thresholdMarker', { threshold: threshold.toFixed(2) })}
					</p>
					<p className="text-text text-sm">{t('decision', { decision })}</p>
					<p className="text-text-muted text-xs">
						{t('model', {
							model: modelReported ?? fallbackModel,
							date:
								completedAt != null
									? format.dateTime(completedAt, { dateStyle: 'medium', timeStyle: 'short' })
									: '—'
						})}
					</p>
					<p className="text-text-muted flex items-center gap-1.5 text-xs">
						<InfoIcon />
						{t('aiNote')}
					</p>
				</div>
			) : status === 'failed' ? (
				<div className="flex flex-col gap-2">
					<StatusChip status="failed" errorCode={errorCode} />
					<p className="text-text flex items-start gap-1.5 text-sm">
						<AlertIcon className="text-danger mt-0.5 shrink-0" />
						{t('failedJudgment', { reason: errorCode ?? 'unknown' })}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					<StatusChip status={status === 'running' ? 'running' : 'pending'} />
					<p className="text-text-muted text-sm">{t('pendingJudgment')}</p>
				</div>
			)}
		</section>
	)
}

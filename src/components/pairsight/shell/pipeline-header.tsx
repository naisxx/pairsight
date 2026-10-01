'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { PipelineData, PipelineStage, PipelineTone } from './pipeline-types'

const TONE_DOT: Record<PipelineTone, string> = {
	action: 'bg-action',
	success: 'bg-success',
	danger: 'bg-danger'
}

// The pipeline at a glance: the evaluation, a one-line status, and one
// segment per stage (striped while a run is going). Folds away when the
// sidebar collapses.
export function PipelineHeader({
	data,
	ordered
}: {
	data: PipelineData
	ordered: PipelineStage[]
}) {
	const t = useTranslations('Pipeline')
	const done = ordered.filter((stage) => stage.state === 'done').length
	return (
		<div className="shell-fade shell-fold flex flex-col gap-1.5 px-1 pb-3">
			<div className="flex items-center justify-between">
				<span className="text-text-muted type-overline">{t('label')}</span>
				<span className="text-text-muted type-data-sm">
					{t('count', { done, total: ordered.length })}
				</span>
			</div>
			<p className="text-text type-subheading truncate" title={data.evaluationName}>
				{data.evaluationName}
			</p>
			<p className="text-text-muted type-meta flex items-center gap-1.5 whitespace-nowrap">
				<span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[data.status.tone])} />
				{data.status.label}
			</p>
			<div className="mt-1 grid grid-cols-6 gap-[3px]" aria-hidden>
				{ordered.map((stage) => (
					<span
						key={stage.key}
						data-running={stage.isRunning === true}
						className={cn(
							'pipe-segment border-border bg-surface-muted h-1 rounded-sm border',
							stage.state === 'done' && 'border-action bg-action',
							stage.state === 'active' && !stage.isRunning && 'border-action bg-action/50',
							stage.isRunning && 'border-action'
						)}
					/>
				))}
			</div>
		</div>
	)
}

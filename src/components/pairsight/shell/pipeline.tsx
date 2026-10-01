'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import { PipelineHeader } from './pipeline-header'
import { PipelineStageLink } from './pipeline-stage'
import {
	currentStageKey,
	type PipelineData,
	type PipelineStage,
	type StageKey
} from './pipeline-types'

// The four phases an evaluation moves through, in order.
const PHASES: Array<{ key: 'input' | 'configure' | 'execute' | 'review'; stages: StageKey[] }> = [
	{ key: 'input', stages: ['records', 'vendors'] },
	{ key: 'configure', stages: ['rules', 'plan'] },
	{ key: 'execute', stages: ['run'] },
	{ key: 'review', stages: ['results'] }
]

// A stage's piece of track below its node: solid once the stage is done,
// flowing while its run is going, dashed ahead.
function trackOut(stage: PipelineStage): 'filled' | 'flowing' | 'dashed' {
	if (stage.isRunning) return 'flowing'
	return stage.state === 'done' ? 'filled' : 'dashed'
}

function trackIn(previous: PipelineStage | undefined): 'filled' | 'dashed' {
	return previous?.state === 'done' ? 'filled' : 'dashed'
}

// The evaluation as a pipeline: stages on one connected track, grouped into
// phases, each showing what it has produced. The page you're on is marked
// separately from how far the pipeline has got.
export function Pipeline({ data }: { data: PipelineData }) {
	const t = useTranslations('Pipeline')
	const pathname = usePathname()
	const currentKey = currentStageKey(data.stages, pathname)
	const byKey = new Map(data.stages.map((stage) => [stage.key, stage]))
	const ordered = PHASES.flatMap((phase) =>
		phase.stages.flatMap((key) => {
			const stage = byKey.get(key)
			return stage == null ? [] : [stage]
		})
	)

	return (
		<section aria-label={t('label')} className="flex flex-col">
			<PipelineHeader data={data} ordered={ordered} />
			<ol className="flex flex-col">
				{PHASES.flatMap((phase) => {
					const firstIndex = ordered.findIndex((stage) => stage.key === phase.stages[0])
					return [
						<li
							key={`phase-${phase.key}`}
							aria-hidden
							data-kind="phase"
							data-first={firstIndex === 0}
							data-in={trackIn(ordered[firstIndex - 1])}
							className={cn(
								'pipe-row shell-fade shell-fold text-text-muted pb-1 pl-11 text-[10px] leading-[14px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase',
								firstIndex === 0 ? 'pt-0' : 'pt-2.5'
							)}
						>
							{t(`phase.${phase.key}`)}
						</li>,
						...phase.stages.flatMap((key) => {
							const index = ordered.findIndex((stage) => stage.key === key)
							const stage = ordered[index]
							if (stage == null) return []
							return [
								<li
									key={stage.key}
									data-kind="stage"
									data-first={index === 0}
									data-last={index === ordered.length - 1}
									data-in={trackIn(ordered[index - 1])}
									data-out={trackOut(stage)}
									className="pipe-row"
								>
									<PipelineStageLink
										stage={stage}
										isCurrent={stage.key === currentKey && stage.state !== 'locked'}
									/>
								</li>
							]
						})
					]
				})}
			</ol>
		</section>
	)
}

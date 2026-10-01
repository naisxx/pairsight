import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { StageKey, StageState } from '@/lib/pairsight/stages'

// An evaluation's six stages as short bars: done, the one to do next, and
// the rest.
export function StageProgress({
	stages,
	className
}: {
	stages: Array<{ key: StageKey; state: StageState }>
	className?: string
}) {
	const t = useTranslations('Evaluations')
	const tSteps = useTranslations('Steps')
	const done = stages.filter((stage) => stage.state === 'done').length
	const active = stages.find((stage) => stage.state === 'active')
	return (
		<div
			role="img"
			aria-label={
				active == null
					? t('stageProgress', { done, total: stages.length })
					: t('stageProgressNext', { done, total: stages.length, stage: tSteps(active.key) })
			}
			className={cn('flex items-center gap-1', className)}
		>
			{stages.map((stage) => (
				<span
					key={stage.key}
					title={tSteps(stage.key)}
					className={cn(
						'h-1.5 w-5 rounded-full transition-[background-color] duration-300 ease-out',
						stage.state === 'done'
							? 'bg-text'
							: stage.state === 'active'
								? 'bg-action'
								: 'bg-surface-muted shadow-[inset_0_0_0_1px_var(--border)]'
					)}
				/>
			))}
		</div>
	)
}

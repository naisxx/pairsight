'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { CheckIcon, LockIcon } from '@/components/ui/icons'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { currentStageKey, type PipelineData, type PipelineStage } from './pipeline-types'
import { useSidebarMode } from './shell-frame'

const CHECK_SIZE = 11
const LOCK_SIZE = 10

// done: ink with a check · active: a coral ring with its number · next: an
// outlined number · locked: muted with a lock.
function StageNode({ state, number }: { state: PipelineStage['state']; number: number }) {
	const base =
		'relative z-[1] flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]'
	if (state === 'done') {
		return (
			<span className={cn(base, 'bg-text text-surface')}>
				<CheckIcon size={CHECK_SIZE} variant="bold" />
			</span>
		)
	}
	if (state === 'locked') {
		return (
			<span className={cn(base, 'bg-surface-muted text-text-muted')}>
				<LockIcon size={LOCK_SIZE} variant="bold" />
			</span>
		)
	}
	if (state === 'active') {
		return (
			<span className={cn(base, 'border-action bg-surface text-accent-ink border-2 font-semibold')}>
				{number}
			</span>
		)
	}
	return (
		<span className={cn(base, 'border-border-input bg-surface text-text-muted border')}>
			{number}
		</span>
	)
}

// The evaluation as a numbered list of stages joined by a line. Each shows
// what it has produced; the page you're on is marked separately from where
// the work is ("Next"). Locked stages explain what they're waiting for.
export function Pipeline({ data }: { data: PipelineData }) {
	const t = useTranslations('Pipeline')
	const tSteps = useTranslations('Steps')
	const pathname = usePathname()
	const { isCollapsed } = useSidebarMode()
	const currentKey = currentStageKey(data.stages, pathname)

	return (
		<ol aria-label={t('label')} className="mt-2 flex flex-col gap-0.5">
			{data.stages.map((stage, index) => {
				const label = tSteps(stage.key)
				const isViewing = stage.key === currentKey && stage.state !== 'locked'
				const isLocked = stage.state === 'locked'
				const status = t(`state.${stage.state}`)
				const content = (
					<>
						<StageNode state={stage.state} number={index + 1} />
						{!isCollapsed && (
							<span className="min-w-0 flex-1">
								<span
									className={cn(
										'type-ui flex items-center gap-1.5 leading-tight',
										isViewing
											? 'text-text font-medium'
											: stage.state === 'next' || isLocked
												? 'text-text-muted'
												: 'text-text'
									)}
								>
									{label}
									{stage.state === 'active' && !isViewing && (
										<span className="bg-accent text-accent-ink rounded-[4px] px-1 text-[10px] font-medium">
											{t('next')}
										</span>
									)}
								</span>
								<span className="text-text-muted type-caption mt-0.5 block truncate">
									{stage.detail}
								</span>
							</span>
						)}
					</>
				)
				const rowClassName = cn(
					'relative flex items-center gap-2.5 rounded-sm py-1.5 transition-colors duration-150',
					isCollapsed ? 'justify-center px-0' : 'px-2',
					isViewing
						? 'bg-selected shadow-[inset_2px_0_0_var(--action)]'
						: !isLocked && 'hover:bg-surface-hover',
					isLocked && 'cursor-not-allowed'
				)
				return (
					<li key={stage.key} className="relative">
						{index < data.stages.length - 1 && (
							<span
								aria-hidden
								className={cn(
									'absolute top-[26px] h-[calc(100%-14px)] w-px',
									isCollapsed ? 'left-1/2' : 'left-[17.5px]',
									stage.state === 'done' ? 'bg-text' : 'bg-border'
								)}
							/>
						)}
						{isLocked ? (
							<Tip content={stage.reason} side="right" disabled={stage.reason == null}>
								<span
									role="link"
									aria-disabled="true"
									tabIndex={0}
									aria-label={`${label}, ${status}. ${stage.reason ?? ''}`}
									className={rowClassName}
								>
									{content}
								</span>
							</Tip>
						) : (
							<Tip content={`${label} · ${stage.detail}`} side="right" disabled={!isCollapsed}>
								<Link
									href={stage.href}
									aria-current={isViewing ? 'page' : undefined}
									aria-label={`${label}, ${status}. ${stage.detail}`}
									className={rowClassName}
								>
									{content}
								</Link>
							</Tip>
						)}
					</li>
				)
			})}
		</ol>
	)
}

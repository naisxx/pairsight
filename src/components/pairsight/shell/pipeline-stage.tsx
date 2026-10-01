'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { CheckIcon, LockIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { PipelineStage } from './pipeline-types'
import { SidebarTip } from './sidebar-tip'

// done: filled coral + check · active: coral ring (pulsing while running) ·
// next: hollow · locked: dashed + lock
function StageNode({ stage }: { stage: PipelineStage }) {
	return (
		<span
			data-running={stage.isRunning === true}
			className={cn(
				'pipe-node grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
				stage.state === 'done' && 'border-action bg-action text-action-ink',
				stage.state === 'active' &&
					'border-action bg-surface text-action border-2 shadow-[0_0_0_4px_color-mix(in_srgb,var(--action)_18%,transparent)]',
				stage.state === 'next' && 'border-border-input bg-surface text-text-muted',
				stage.state === 'locked' && 'border-border-input bg-surface text-text-muted border-dashed'
			)}
		>
			{stage.state === 'done' ? (
				<CheckIcon size={12} />
			) : stage.state === 'locked' ? (
				<LockIcon size={11} />
			) : stage.state === 'active' ? (
				<span className="bg-action size-2 rounded-full" />
			) : null}
		</span>
	)
}

// Geometry shared with the track (globals.css, .pipe-row): 12px left
// padding + half a 24px node puts every node on the sidebar's centre line.
const ROW = 'flex items-start gap-2.5 overflow-hidden rounded py-[7px] pr-2 pl-3 whitespace-nowrap'

// One stage: its node, name and what it has produced. Locked stages aren't
// links; the page you're on is marked with the selection style.
export function PipelineStageLink({
	stage,
	isCurrent
}: {
	stage: PipelineStage
	isCurrent: boolean
}) {
	const tSteps = useTranslations('Steps')
	const label = tSteps(stage.key)
	const content = (
		<>
			<StageNode stage={stage} />
			<span className="shell-fade flex min-w-0 flex-col pt-px">
				<span
					className={cn(
						'type-label truncate',
						isCurrent || stage.state === 'done' || stage.state === 'active'
							? 'text-text'
							: 'text-text-muted'
					)}
				>
					{label}
				</span>
				<span
					className={cn(
						'type-data-sm truncate text-[11px] leading-4',
						stage.state === 'active' ? 'text-accent-ink' : 'text-text-muted'
					)}
				>
					{stage.detail}
				</span>
			</span>
		</>
	)
	return (
		<SidebarTip label={`${label} · ${stage.detail}`}>
			{stage.state === 'locked' ? (
				<span className={cn(ROW, 'cursor-not-allowed opacity-80')} aria-disabled="true">
					{content}
				</span>
			) : (
				<Link
					href={stage.href}
					aria-current={isCurrent ? 'page' : undefined}
					aria-label={`${label}, ${stage.detail}`}
					className={cn(
						ROW,
						'focus-visible:outline-ring transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
						isCurrent
							? 'bg-selected shadow-[inset_3px_0_0_var(--action)]'
							: 'hover:bg-surface-hover'
					)}
				>
					{content}
				</Link>
			)}
		</SidebarTip>
	)
}

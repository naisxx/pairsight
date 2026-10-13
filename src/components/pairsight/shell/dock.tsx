'use client'

import { createContext, use } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { ArrowLeftIcon, CheckIcon, LockIcon } from '@/components/ui/icons'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { stepNumber } from '@/lib/pairsight/stages'
import { currentStageKey, type PipelineData, type PipelineStage } from './pipeline-types'

const CHECK_SIZE = 13
const LOCK_SIZE = 12
const BACK_ICON_SIZE = 16

// The evaluation's steps, from the shell to whichever dock the page shows.
const PipelineContext = createContext<PipelineData | undefined>(undefined)

export function PipelineProvider({
	pipeline,
	children
}: {
	pipeline?: PipelineData
	children: React.ReactNode
}) {
	return <PipelineContext value={pipeline}>{children}</PipelineContext>
}

// The tile before a step's name: a tick once it's done, its number otherwise,
// a lock while it's waiting on an earlier step.
function StepTile({ stage, isCurrent }: { stage: PipelineStage; isCurrent: boolean }) {
	const base =
		'inline-flex size-7 shrink-0 items-center justify-center rounded-sm font-mono text-[0.8125rem] max-[599px]:size-6 max-[599px]:text-xs'
	if (isCurrent) {
		// On a phone the step you're on shows its name alone, so the row fits.
		return (
			<span className={cn(base, 'bg-action-ink/10 max-[599px]:hidden')}>
				{stepNumber(stage.key)}
			</span>
		)
	}
	if (stage.state === 'done') {
		return (
			<span className={cn(base, 'bg-on-inverse/16')}>
				<CheckIcon size={CHECK_SIZE} variant="bold" />
			</span>
		)
	}
	if (stage.state === 'locked') {
		return (
			<span className={cn(base, 'ring-on-inverse/35 ring-1 ring-inset')}>
				<LockIcon size={LOCK_SIZE} variant="bold" />
			</span>
		)
	}
	return (
		<span
			className={cn(
				base,
				stage.state === 'active' ? 'bg-on-inverse/16' : 'ring-on-inverse/35 ring-1 ring-inset'
			)}
		>
			{stepNumber(stage.key)}
		</span>
	)
}

function Steps({ pipeline }: { pipeline: PipelineData }) {
	const t = useTranslations('Pipeline')
	const tSteps = useTranslations('Steps')
	const pathname = usePathname()
	const currentKey = currentStageKey(pipeline.stages, pathname)

	return (
		<ol aria-label={t('label')} className="flex flex-wrap items-center gap-1.5 max-[599px]:gap-1">
			{pipeline.stages.map((stage) => {
				const label = tSteps(stage.key)
				const isLocked = stage.state === 'locked'
				const isCurrent = stage.key === currentKey && !isLocked
				const isLater = !isCurrent && (stage.state === 'next' || isLocked)
				const status = t(`state.${stage.state}`)
				const className = cn(
					'inline-flex min-h-12 items-center gap-2.5 rounded-[14px] pr-3.5 pl-2.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color] duration-150',
					isCurrent
						? 'bg-action text-action-ink'
						: isLater
							? 'text-on-inverse/60'
							: 'text-on-inverse',
					!isCurrent && !isLocked && 'hover:bg-on-inverse/12',
					// On a phone the steps close up, so all five share one row.
					'max-[599px]:min-h-11 max-[599px]:gap-2 max-[599px]:text-sm',
					isCurrent ? 'max-[599px]:px-3' : 'max-[599px]:px-2.5',
					isLocked && 'cursor-not-allowed'
				)
				const content = (
					<>
						<StepTile stage={stage} isCurrent={isCurrent} />
						{/* Narrow, only the step you're on keeps its name. */}
						<span className={cn(!isCurrent && 'max-[56.25rem]:hidden')}>{label}</span>
					</>
				)
				return (
					<li key={stage.key}>
						{isLocked ? (
							<Tip content={stage.reason} side="top" disabled={stage.reason == null}>
								<span
									role="link"
									aria-disabled="true"
									tabIndex={0}
									aria-label={`${label}, ${status}. ${stage.reason ?? ''}`}
									className={className}
								>
									{content}
								</span>
							</Tip>
						) : (
							<Tip content={stage.detail} side="top">
								<Link
									href={stage.href}
									aria-current={isCurrent ? 'step' : undefined}
									aria-label={`${label}, ${status}. ${stage.detail}`}
									className={className}
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

// A view of the current step in the dock (Results' Overview and Pairs), the
// one you're on lit; `count` sits in its own tile after the name.
export function DockLink({
	href,
	isCurrent,
	count,
	children
}: {
	href: React.ComponentProps<typeof Link>['href']
	isCurrent: boolean
	count?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<Link
			href={href}
			aria-current={isCurrent ? 'page' : undefined}
			className={cn(
				'text-on-inverse inline-flex min-h-12 items-center gap-2.5 rounded-[14px] px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color] duration-150 max-[599px]:gap-2 max-[599px]:px-3',
				isCurrent ? 'bg-on-inverse/18' : 'hover:bg-on-inverse/12'
			)}
		>
			{children}
			{count != null && (
				<span className="bg-on-inverse/16 inline-flex h-7 min-w-7 items-center justify-center rounded-sm px-2 font-mono text-[0.8125rem]">
					{count}
				</span>
			)}
		</Link>
	)
}

// The dock (pairsight-handoff Components): a dark bar floating 20px above
// the bottom of the window with the evaluation's steps and the page's next
// action. Pages with a next action render it through ActionBar
// (step-layout.tsx), inside their own form; every other evaluation page
// gets the shell's, with the steps only. `mt-auto` rests it at the bottom of
// a short page and sticky keeps it in view on a long one, so it never covers
// the page's last content.
export function Dock({
	back,
	hint,
	hintId,
	isShell = false,
	children
}: {
	// The previous step, before the next action.
	back?: { href: string; label: string }
	// Why the next action is blocked, or what it will do, above the dock.
	hint?: React.ReactNode
	hintId?: string
	// The shell's own dock, hidden when the page shows one (globals.css).
	isShell?: boolean
	children?: React.ReactNode
}) {
	const t = useTranslations('Shell')
	const pipeline = use(PipelineContext)
	const hasActions = back != null || children != null
	if (pipeline == null && !hasActions) return null

	return (
		<div
			data-shell-dock={isShell ? '' : undefined}
			data-page-dock={isShell ? undefined : ''}
			className="pointer-events-none sticky bottom-5 z-20 mt-auto flex flex-col items-center gap-2 pt-14"
		>
			{hint != null && (
				<p
					id={hintId}
					role="status"
					className="bg-surface-elevated text-text-body type-ui border-border shadow-elevated pointer-events-auto flex max-w-[calc(100%-32px)] items-center gap-1.5 rounded-md border px-3 py-1.5"
				>
					{hint}
				</p>
			)}
			<nav
				aria-label={t('steps')}
				data-dock
				className="bg-inverse text-on-inverse shadow-elevated pointer-events-auto flex w-fit max-w-[calc(100%-32px)] flex-wrap items-center gap-1.5 rounded-xl p-2 max-[599px]:max-w-full"
			>
				{pipeline != null && <Steps pipeline={pipeline} />}
				{pipeline != null && hasActions && (
					<span
						aria-hidden
						className="bg-on-inverse/22 mx-1 my-2 w-px self-stretch max-[599px]:hidden"
					/>
				)}
				{hasActions && (
					<div data-dock-actions className="flex flex-wrap items-center gap-1.5">
						{back != null && (
							<Link
								href={back.href}
								className="text-on-inverse hover:bg-on-inverse/12 inline-flex min-h-12 items-center gap-2 rounded-[14px] px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color] duration-150"
							>
								<ArrowLeftIcon size={BACK_ICON_SIZE} />
								{back.label}
							</Link>
						)}
						{children}
					</div>
				)}
			</nav>
		</div>
	)
}

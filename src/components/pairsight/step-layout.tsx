import { useTranslations } from 'next-intl'
import { STAGE_KEYS, stepNumber, type StageKey } from '@/lib/pairsight/stages'
import { Dock } from './shell/dock'

// The hint's id, so a blocked primary action can point at why
// (aria-describedby). One action bar per page, so one id.
export const ACTION_HINT_ID = 'action-bar-hint'

// Every step: a title, one sentence of context, the content, then the dock
// with the stage's one next action (docs/PairSight-UX-Plan.md §3–4).

export function StepHeader({
	step,
	title,
	description,
	children
}: {
	// Which step this is, said above the title ("Step 03 of 05").
	step?: StageKey
	// A string, or a sentence with its key number wrapped in <StepEmphasis>.
	title: React.ReactNode
	description: React.ReactNode
	// Sits beside the title: a status chip, a count.
	children?: React.ReactNode
}) {
	const t = useTranslations('Steps')
	return (
		<header className="mb-10 flex flex-wrap items-start justify-between gap-4">
			<div className="max-w-[1040px]">
				{step != null && (
					<p className="text-text-muted type-eyebrow mb-3.5">
						{t('stepOf', {
							number: stepNumber(step),
							total: stepNumber(STAGE_KEYS.length)
						})}
					</p>
				)}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<h1 className="text-text font-display text-[clamp(2.5rem,4.6vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance">
						{title}
					</h1>
					{children}
				</div>
				<p className="text-text-body mt-4 max-w-[680px] text-[1.1875rem] leading-[1.875rem]">
					{description}
				</p>
			</div>
		</header>
	)
}

// The number a step's headline turns on, in coral ("Jev will check 812 pairs").
export function StepEmphasis({ children }: { children: React.ReactNode }) {
	return <em className="text-accent-ink not-italic">{children}</em>
}

export function ActionBar({
	hint,
	back,
	children
}: {
	hint?: React.ReactNode
	// The previous stage, before the next action.
	back?: { href: string; label: string }
	// None on Check and start, where Start run sits with what it starts.
	children?: React.ReactNode
}) {
	// The page's next action lives in the dock with the steps (shell/dock.tsx),
	// rendered here so a submit button stays inside its form.
	return (
		<Dock back={back} hint={hint} hintId={ACTION_HINT_ID}>
			{children}
		</Dock>
	)
}

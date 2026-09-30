'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { CheckIcon, LockIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

export type StepState = 'complete' | 'current' | 'available' | 'locked'

export type Step = {
	key: 'records' | 'vendors' | 'rules' | 'plan' | 'run' | 'results'
	href: string
	state: Exclude<StepState, 'current'>
	// Other paths that belong to this step (e.g. a pair page is part of Results).
	alsoMatches?: string[]
}

function matchLength(step: Step, pathname: string): number {
	const matches = [step.href, ...(step.alsoMatches ?? [])].filter(
		(href) => pathname === href || pathname.startsWith(`${href}/`)
	)
	return Math.max(0, ...matches.map((href) => href.length))
}

// The workspace's step list (docs/PairSight-UX-Plan.md §3): a rail on wide
// screens, a horizontally scrolling row on narrow ones. Locked steps say why.
export function StepperRail({ steps }: { steps: Step[] }) {
	const t = useTranslations('Steps')
	const pathname = usePathname()
	// The most specific match wins: /runs/x/results is Results, not Run.
	const currentKey = steps
		.map((step) => ({ key: step.key, length: matchLength(step, pathname) }))
		.filter((candidate) => candidate.length > 0)
		.sort((a, b) => b.length - a.length)[0]?.key
	return (
		<nav aria-label={t('setup')}>
			<ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
				{steps.map((step, index) => {
					const isCurrent = step.key === currentKey
					const content = (
						<>
							<span
								className={cn(
									'type-data-sm flex size-6 shrink-0 items-center justify-center rounded-full border font-medium',
									isCurrent
										? 'border-action bg-action text-action-ink'
										: step.state === 'complete'
											? 'border-accent-ink/50 text-accent-ink'
											: 'border-border-input text-text-muted'
								)}
							>
								{step.state === 'complete' && !isCurrent ? (
									<CheckIcon size={12} />
								) : step.state === 'locked' ? (
									<LockIcon size={12} />
								) : (
									index + 1
								)}
							</span>
							<span className="whitespace-nowrap">{t(step.key)}</span>
						</>
					)
					return (
						<li key={step.key} className="shrink-0">
							{step.state === 'locked' && !isCurrent ? (
								<span
									className="text-text-muted type-label flex cursor-not-allowed items-center gap-2.5 rounded px-2.5 py-2 opacity-70"
									title={t('locked')}
									aria-disabled="true"
								>
									{content}
									<span className="sr-only">{t('locked')}</span>
								</span>
							) : (
								<Link
									href={step.href}
									aria-current={isCurrent ? 'step' : undefined}
									className={cn(
										'focus-visible:outline-ring type-label flex items-center gap-2.5 rounded px-2.5 py-2 transition-colors focus-visible:outline-2',
										isCurrent
											? 'bg-selected text-text shadow-[inset_3px_0_0_var(--action)]'
											: 'text-text-muted hover:bg-surface-hover hover:text-text'
									)}
								>
									{content}
									{step.state === 'complete' && <span className="sr-only">{t('complete')}</span>}
								</Link>
							)}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

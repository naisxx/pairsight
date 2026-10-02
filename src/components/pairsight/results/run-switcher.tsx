'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons'
import { useEvaluationView } from '../evaluation-context'

export type RunOption = {
	id: string
	number: number
	createdAt: Date
	threshold: number
	status: 'running' | 'completed' | 'stopped'
}

// Moves between this evaluation's runs. Each opens that run's results
// unfiltered, since a filter or vendor from one run may not exist in another.
export function RunSwitcher({ runId, runs }: { runId: string; runs: RunOption[] }) {
	const t = useTranslations('Results')
	const format = useFormatter()
	const view = useEvaluationView()
	const current = runs.find((run) => run.id === runId)
	const label = (run: RunOption) =>
		t('runOption', {
			number: run.number,
			date: format.dateTime(run.createdAt, { dateStyle: 'medium', timeStyle: 'short' })
		})

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={t('runSwitcher')}
					className="border-border-input bg-surface text-text type-ui flex h-8 w-[250px] max-w-full items-center justify-between gap-2 rounded-sm border pr-2.5 pl-3 text-left"
				>
					<span className="truncate">{current != null ? label(current) : t('runSwitcher')}</span>
					<ChevronDownIcon size={14} className="text-text-muted shrink-0" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-72">
				{runs.map((run) => (
					<DropdownMenuItem key={run.id} asChild>
						<Link
							href={`${view.base}/runs/${run.id}/results`}
							aria-current={run.id === runId ? 'page' : undefined}
							className="flex items-center gap-2"
						>
							<CheckIcon className={run.id === runId ? undefined : 'invisible'} />
							<span className="flex-1">{label(run)}</span>
							{run.status !== 'completed' && (
								<span className="text-text-muted type-meta">{t(`runStatus.${run.status}`)}</span>
							)}
						</Link>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

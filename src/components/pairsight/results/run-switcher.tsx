'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { CheckIcon, ChevronsUpDownIcon } from '@/components/ui/icons'

export type RunOption = {
	id: string
	number: number
	createdAt: Date
	threshold: number
	status: 'running' | 'completed' | 'stopped'
}

// Moves between this evaluation's runs. Each opens that run's results
// unfiltered, since a filter or vendor from one run may not exist in another.
export function RunSwitcher({
	evaluationId,
	runId,
	runs
}: {
	evaluationId: string
	runId: string
	runs: RunOption[]
}) {
	const t = useTranslations('Results')
	const format = useFormatter()
	const current = runs.find((run) => run.id === runId)
	const label = (run: RunOption) =>
		t('runOption', {
			number: run.number,
			date: format.dateTime(run.createdAt, { dateStyle: 'medium' }),
			threshold: run.threshold.toFixed(2)
		})

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" aria-label={t('runSwitcher')}>
					{current != null ? label(current) : t('runSwitcher')}
					<ChevronsUpDownIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-72">
				{runs.map((run) => (
					<DropdownMenuItem key={run.id} asChild>
						<Link
							href={`/evaluations/${evaluationId}/runs/${run.id}/results`}
							aria-current={run.id === runId ? 'page' : undefined}
							className="type-body flex items-center gap-2"
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

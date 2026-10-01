import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Reveal } from '@/components/ui/reveal'
import { ArrowRightIcon, SuccessIcon } from '@/components/ui/icons'
import type { DashboardRow } from '@/server/pairsight/dashboard'
import { NewEvaluationButton } from './new-evaluation-button'
import { StageProgress } from './stage-progress'

const ARROW_SIZE = 14
const EMPTY_ICON_SIZE = 20

// Evaluations without finished results, each linking to the stage to pick
// up from.
export function ContinueSetup({
	rows,
	takenNames
}: {
	rows: DashboardRow[]
	takenNames: string[]
}) {
	const t = useTranslations('Evaluations')
	const tSteps = useTranslations('Steps')
	const format = useFormatter()
	return (
		<section
			aria-labelledby="continue-title"
			className="border-border bg-surface flex h-full flex-col rounded-md border"
		>
			<header className="flex items-center justify-between px-4 pt-4 pb-1">
				<h2 id="continue-title" className="text-sm font-semibold">
					{t('continueTitle')}
				</h2>
				<span className="text-text-muted font-mono text-xs">{rows.length}</span>
			</header>
			{rows.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
					<span className="bg-surface-muted text-text-muted flex size-10 items-center justify-center rounded-full">
						<SuccessIcon size={EMPTY_ICON_SIZE} />
					</span>
					<p className="mt-3 text-sm font-semibold">{t('nothingWaitingTitle')}</p>
					<p className="type-ui text-text-muted mt-1">{t('nothingWaiting')}</p>
					<div className="mt-4">
						<NewEvaluationButton variant="secondary" size="sm" takenNames={takenNames} />
					</div>
				</div>
			) : (
				<ul className="flex-1 px-2 pb-2">
					{rows.map((row, index) => (
						<Reveal as="li" key={row.id} index={index + 1}>
							<Link
								href={row.next?.href ?? `/evaluations/${row.id}`}
								className="group hover:bg-surface-hover flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-150"
							>
								<span className="min-w-0 flex-1">
									<span className="type-ui text-text block truncate font-medium">{row.name}</span>
									<span className="mt-1.5 flex items-center gap-2">
										<StageProgress stages={row.stages} />
										{row.next != null && (
											<span className="text-text-muted type-caption truncate">
												{t.rich('next', {
													stage: tSteps(row.next.key),
													strong: (chunks) => <span className="text-text">{chunks}</span>
												})}
											</span>
										)}
									</span>
									<span className="text-text-muted type-caption mt-1 block">
										{t('updated', {
											date: format.dateTime(row.updatedAt, { dateStyle: 'medium' })
										})}
									</span>
								</span>
								<ArrowRightIcon
									size={ARROW_SIZE}
									className="text-text-muted shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
								/>
							</Link>
						</Reveal>
					))}
				</ul>
			)}
		</section>
	)
}

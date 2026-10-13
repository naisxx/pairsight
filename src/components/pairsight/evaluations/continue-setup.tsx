import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Reveal } from '@/components/ui/reveal'
import { HideIfDeleting } from './pending-deletes'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { EmptyState } from '../empty-state'
import { CaughtUpScene } from '../empty/scenes'
import type { DashboardRow } from '@/server/pairsight/dashboard'
import { NewEvaluationButton } from './new-evaluation-button'
import { StageProgress } from './stage-progress'

const ARROW_SIZE = 14

// Evaluations without finished results, each linking to the stage to pick
// up from: the newest few (`rows`), and how many there are in all (`total`).
export function ContinueSetup({
	rows,
	total,
	takenNames,
	isReadOnly
}: {
	rows: DashboardRow[]
	total: number
	takenNames: string[]
	// The sandbox: "start your own" is a sign-up, not a new evaluation.
	isReadOnly: boolean
}) {
	const t = useTranslations('Evaluations')
	const tSteps = useTranslations('Steps')
	const format = useFormatter()
	return (
		<section
			aria-labelledby="continue-title"
			className="border-border bg-surface flex h-full flex-col rounded-lg border"
		>
			<header className="flex items-center justify-between px-4 pt-4 pb-1">
				<h2 id="continue-title" className="type-heading">
					{t('continueTitle')}
				</h2>
				{total > 0 && (
					<span className="text-text-muted text-xs">
						{t.rich('continueTotal', {
							count: total,
							n: (chunks) => <span className="text-text font-mono">{chunks}</span>
						})}
					</span>
				)}
			</header>
			{rows.length === 0 ? (
				<EmptyState
					scene={<CaughtUpScene />}
					title={t('nothingWaitingTitle')}
					titleAs="p"
					description={t('nothingWaiting')}
					className="flex-1 justify-center py-8"
					actions={
						isReadOnly ? (
							<Button variant="secondary" size="sm" asChild>
								<Link href="/sign-up">{t('startYourOwn')}</Link>
							</Button>
						) : (
							<NewEvaluationButton variant="secondary" size="sm" takenNames={takenNames} />
						)
					}
				/>
			) : (
				<ul className="flex-1 px-2 pb-2">
					{rows.map((row, index) => (
						<HideIfDeleting key={row.id} id={row.id}>
							<Reveal as="li" index={index + 1}>
								<Link
									href={row.next?.href ?? row.href}
									className="group hover:bg-surface-hover flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-150"
								>
									<span className="min-w-0 flex-1">
										<span className="type-ui text-text block truncate font-medium">{row.name}</span>
										<span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
											<StageProgress stages={row.stages} />
											{row.next != null && (
												<span className="text-text-muted type-caption">
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
						</HideIfDeleting>
					))}
				</ul>
			)}
		</section>
	)
}

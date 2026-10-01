import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { CreateEvaluationForm } from '@/components/pairsight/create-evaluation-form'
import { EmptyState } from '@/components/pairsight/empty/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRightIcon, EvaluationIcon } from '@/components/ui/icons'
import { requireUserOrRedirect } from '@/server/auth/session'
import { listEvaluations } from '@/server/pairsight/evaluations'

export default async function EvaluationsPage() {
	const user = await requireUserOrRedirect('/evaluations')
	const [t, tShell, format, evaluations] = await Promise.all([
		getTranslations('Evaluations'),
		getTranslations('Shell'),
		getFormatter(),
		listEvaluations(user.id)
	])
	return (
		<AppShell email={user.email} name={user.name} crumbs={[{ label: tShell('evaluations') }]}>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-1">
					<h1 className="text-text type-title">{t('title')}</h1>
					<p className="text-text-muted type-body">{t('description')}</p>
				</div>
				<Card>
					<CardContent className="pt-6">
						<h2 className="text-text type-subheading mb-3">{t('newTitle')}</h2>
						<CreateEvaluationForm />
					</CardContent>
				</Card>
				{evaluations.length === 0 ? (
					<div className="border-border bg-surface rounded-lg border">
						<EmptyState
							icon={EvaluationIcon}
							title={t('emptyTitle')}
							description={t('emptyDescription')}
							preview="list"
						/>
					</div>
				) : (
					<ul className="border-border bg-surface divide-border divide-y rounded-lg border">
						{evaluations.map((evaluation) => {
							const lastRun = evaluation.runs[0]
							return (
								<li key={evaluation.id}>
									<Link
										href={`/evaluations/${evaluation.id}`}
										className="hover:bg-surface-hover focus-visible:outline-ring flex items-center gap-4 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
									>
										<span className="text-text type-label min-w-0 flex-1 truncate">
											{evaluation.name}
										</span>
										<span className="text-text-muted type-body hidden sm:block">
											{lastRun == null
												? t('noRuns')
												: t('runSummary', { number: lastRun.number, pairs: lastRun.pairCount })}
										</span>
										<span className="text-text-muted type-meta w-28 text-right">
											{format.relativeTime(evaluation.updatedAt)}
										</span>
										<ChevronRightIcon className="text-text-muted" />
									</Link>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</AppShell>
	)
}

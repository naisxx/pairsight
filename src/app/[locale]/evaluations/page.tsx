import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AppHeader } from '@/components/pairsight/app-header'
import { CreateEvaluationForm } from '@/components/pairsight/create-evaluation-form'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRightIcon } from '@/components/ui/icons'
import { requireUserOrRedirect } from '@/server/auth/session'
import { listEvaluations } from '@/server/pairsight/evaluations'

export default async function EvaluationsPage() {
	const user = await requireUserOrRedirect('/evaluations')
	const [t, format, evaluations] = await Promise.all([
		getTranslations('Evaluations'),
		getFormatter(),
		listEvaluations(user.id)
	])
	return (
		<>
			<AppHeader />
			<main id="main" className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
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
					<div className="border-border flex flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-12 text-center">
						<p className="text-text font-medium">{t('emptyTitle')}</p>
						<p className="text-text-muted type-body">{t('emptyDescription')}</p>
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
			</main>
		</>
	)
}

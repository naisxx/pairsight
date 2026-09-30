import { getFormatter, getTranslations } from 'next-intl/server'
import { PlanBlockers } from '@/components/pairsight/plan/plan-blockers'
import { PlanBreakdown } from '@/components/pairsight/plan/plan-breakdown'
import { ActionBar, Section, StepHeader } from '@/components/pairsight/step-layout'
import { StartRunButton } from '@/components/pairsight/start-run-button'
import { InfoIcon } from '@/components/ui/icons'
import { LIMITS } from '@/server/pairsight/limits'
import { estimateCostUsd } from '@/server/pairsight/cost'
import { computePlan } from '@/server/pairsight/plan'
import { loadWorkspace } from '../workspace'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ user }, t, tRoles, format] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/plan`),
		getTranslations('Plan'),
		getTranslations('Roles'),
		getFormatter()
	])
	const plan = await computePlan({ ownerId: user.id, evaluationId: id })
	const counts = plan.counts ?? null
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
				{counts != null ? (
					<PlanBreakdown counts={counts} maxPairsPerRun={LIMITS.maxPairsPerRun} />
				) : (
					<div />
				)}
				<div className="flex flex-col gap-6">
					<Section title={t('jevReceivesTitle')}>
						<p className="text-text type-body">
							{t('jevReceives', {
								fields:
									plan.config != null
										? plan.config.jevFields.map((field) => tRoles(field)).join(', ')
										: '—'
							})}
						</p>
						{counts != null && (
							<p className="text-text-muted type-meta mt-3">
								{t('cost', {
									cost: format.number(estimateCostUsd(counts.toEvaluate), {
										style: 'currency',
										currency: 'USD',
										maximumFractionDigits: 4
									})
								})}
							</p>
						)}
						<p className="text-text-muted type-meta mt-2 flex items-center gap-1.5">
							<InfoIcon />
							{t('fictionalOnly')}
						</p>
					</Section>
					{plan.blockers.length > 0 && (
						<PlanBlockers
							evaluationId={id}
							blockers={plan.blockers}
							contributors={plan.contributors ?? []}
							uniquePairs={counts?.uniquePairs ?? 0}
							maxPairsPerRun={LIMITS.maxPairsPerRun}
						/>
					)}
				</div>
			</div>
			<ActionBar>
				<StartRunButton evaluationId={id} isDisabled={plan.blockers.length > 0} />
			</ActionBar>
		</>
	)
}

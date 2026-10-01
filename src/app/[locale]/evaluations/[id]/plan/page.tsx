import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { PlanBlockers } from '@/components/pairsight/plan/plan-blockers'
import { PlanLedger } from '@/components/pairsight/plan/plan-ledger'
import { PlanSide } from '@/components/pairsight/plan/plan-side'
import { StartRunButton } from '@/components/pairsight/start-run-button'
import { ActionBar, StepHeader } from '@/components/pairsight/step-layout'
import { AlertIcon, ArrowRightIcon, InfoIcon } from '@/components/ui/icons'
import { estimateCostUsd } from '@/server/pairsight/cost'
import { LIMITS } from '@/server/pairsight/limits'
import { computePlan } from '@/server/pairsight/plan'
import { listVendors } from '@/server/pairsight/vendor-exports'
import { loadWorkspace } from '../workspace'

const ICON_SIZE = 15
const COST_FRACTION_DIGITS = 4

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ user, workspace }, t, format] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/plan`, 'plan'),
		getTranslations('Plan'),
		getFormatter()
	])
	const { dataset } = workspace
	const [plan, vendors] = await Promise.all([
		computePlan({ ownerId: user.id, evaluationId: id }),
		dataset == null ? Promise.resolve([]) : listVendors(id, dataset.id)
	])
	const counts = ('counts' in plan ? plan.counts : undefined) ?? null
	const contributors = ('contributors' in plan ? plan.contributors : undefined) ?? []
	const drafts = vendors.filter((vendor) => vendor.kind === 'draft').map((vendor) => vendor.name)
	const ruleMatches = contributors.reduce(
		(sum, item) => (item.kind === 'rule' ? sum + item.pairCount : sum),
		0
	)
	const [firstBlocker] = plan.blockers
	const blockedReason =
		firstBlocker == null
			? null
			: firstBlocker === 'too_many_pairs'
				? t('blockedOver', { count: (counts?.uniquePairs ?? 0) - LIMITS.maxPairsPerRun })
				: t(firstBlocker)

	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />

			{drafts.length > 0 && (
				<p className="bg-warning-subtle text-warning type-ui mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm p-3">
					<AlertIcon size={ICON_SIZE} className="shrink-0" />
					<span>{t('draftsNotice', { names: drafts.join(', '), count: drafts.length })}</span>
					<Link
						href={`/evaluations/${id}/vendors`}
						className="inline-flex items-center gap-1 font-medium hover:underline"
					>
						{t('draftsLink')}
						<ArrowRightIcon size={ICON_SIZE} />
					</Link>
				</p>
			)}

			{plan.blockers.length > 0 && (
				<div className="mb-4">
					<PlanBlockers
						evaluationId={id}
						blockers={plan.blockers}
						contributors={contributors}
						rules={plan.rules}
						uniquePairs={counts?.uniquePairs ?? 0}
						maxPairsPerRun={LIMITS.maxPairsPerRun}
					/>
				</div>
			)}

			<div className="grid gap-4 lg:grid-cols-12">
				<div className="lg:col-span-7">
					{counts != null && dataset != null && (
						<PlanLedger
							counts={counts}
							fileName={dataset.fileName}
							ruleMatches={ruleMatches}
							ruleCount={plan.rules.length}
							cost={format.number(estimateCostUsd(counts.toEvaluate), {
								style: 'currency',
								currency: 'USD',
								maximumFractionDigits: COST_FRACTION_DIGITS
							})}
							isOverLimit={counts.uniquePairs > LIMITS.maxPairsPerRun}
						/>
					)}
				</div>
				<div className="lg:col-span-5">
					<PlanSide
						jevFields={'config' in plan && plan.config != null ? plan.config.jevFields : []}
						counts={counts}
					/>
				</div>
			</div>

			<ActionBar
				back={{ href: `/evaluations/${id}/rules`, label: t('back') }}
				hint={
					blockedReason == null ? undefined : (
						<>
							<InfoIcon size={ICON_SIZE} className="shrink-0" />
							<span>{blockedReason}</span>
						</>
					)
				}
			>
				<StartRunButton evaluationId={id} isDisabled={plan.blockers.length > 0} />
			</ActionBar>
		</>
	)
}

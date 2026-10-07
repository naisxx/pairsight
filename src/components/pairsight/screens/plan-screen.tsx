import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { RUNS_PARAM } from '@/lib/pairsight/evaluation-view'
import { Button } from '@/components/ui/button'
import { PlanBlockers } from '@/components/pairsight/plan/plan-blockers'
import { PlanLedger } from '@/components/pairsight/plan/plan-ledger'
import { PlanSide } from '@/components/pairsight/plan/plan-side'
import { RefreshWhile } from '@/components/pairsight/refresh-while'
import { StartRunButton } from '@/components/pairsight/start-run-button'
import { ActionBar, StepHeader } from '@/components/pairsight/step-layout'
import { AlertIcon, ArrowRightIcon, InfoIcon } from '@/components/ui/icons'
import { estimateCostUsd } from '@/server/pairsight/cost'
import { estimateRunDuration } from '@/server/pairsight/run-estimate'
import { recentCheckRate } from '@/server/pairsight/run-speed'
import { LIMITS } from '@/server/pairsight/limits'
import { computePlan } from '@/server/pairsight/plan'
import { listVendors } from '@/server/pairsight/vendor-exports'
import type { LoadedWorkspace } from '@/server/pairsight/evaluation-pages'
import { ReadOnlyGate } from '@/components/pairsight/read-only'
import { runnableRules } from '@/lib/pairsight/rule-fields'
import { mappedIdentityRoles } from '@/server/pairsight/fields'
import { parseColumnRoles } from '@/server/pairsight/json'
import { entityTypeOf } from '@/lib/pairsight/entity-types'

const ICON_SIZE = 15
const COST_FRACTION_DIGITS = 4

export async function PlanScreen({ loaded }: { loaded: LoadedWorkspace }) {
	const { workspace, view, scope } = loaded
	const id = view.evaluationId
	const [t, format] = await Promise.all([getTranslations('Plan'), getFormatter()])
	const { dataset } = workspace
	const latestRun = workspace.runs[0]
	const [plan, vendors, pairsPerSecond] = await Promise.all([
		computePlan({ scope, evaluationId: id }),
		dataset == null ? Promise.resolve([]) : listVendors(id, dataset.id),
		recentCheckRate()
	])
	const counts = ('counts' in plan ? plan.counts : undefined) ?? null
	const contributors = ('contributors' in plan ? plan.contributors : undefined) ?? []
	const splink = ('splink' in plan ? plan.splink : undefined) ?? {
		state: 'off' as const,
		reason: null
	}
	const drafts = vendors.filter((vendor) => vendor.kind === 'draft').map((vendor) => vendor.name)
	const ruleMatches = contributors.reduce(
		(sum, item) => (item.kind === 'rule' ? sum + item.pairCount : sum),
		0
	)
	// Rules that can run on this mapping; one whose field isn't mapped finds nothing.
	const ruleCount =
		dataset == null
			? 0
			: runnableRules(plan.rules, mappedIdentityRoles(parseColumnRoles(dataset.columnRoles))).length
	const [firstBlocker] = plan.blockers
	const blockedReason =
		firstBlocker == null
			? null
			: firstBlocker === 'too_many_pairs'
				? counts?.isExact === false
					? t('blockedOverMany')
					: t('blockedOver', { count: (counts?.uniquePairs ?? 0) - LIMITS.maxPairsPerRun })
				: t(firstBlocker)

	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			{/* Splink is still looking: the plan fills in by itself when it's done. */}
			<RefreshWhile isActive={splink.state === 'waiting'} />

			{drafts.length > 0 && (
				<p className="bg-warning-subtle text-warning type-ui mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm p-3">
					<AlertIcon size={ICON_SIZE} className="shrink-0" />
					<span>{t('draftsNotice', { names: drafts.join(', '), count: drafts.length })}</span>
					<Link
						href={`${view.base}/vendors`}
						className="inline-flex items-center gap-1 font-medium hover:underline"
					>
						{t('draftsLink')}
						<ArrowRightIcon size={ICON_SIZE} />
					</Link>
				</p>
			)}

			{plan.blockers.some((blocker) => blocker !== 'still_suggesting') && (
				<div className="mb-4">
					<PlanBlockers
						base={view.base}
						evaluationId={id}
						blockers={plan.blockers}
						contributors={contributors}
						rules={plan.rules}
						uniquePairs={counts?.uniquePairs ?? 0}
						isExact={counts?.isExact ?? true}
						maxPairsPerRun={LIMITS.maxPairsPerRun}
					/>
				</div>
			)}

			<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
				<div className="@5xl:col-span-7">
					{counts != null && dataset != null && (
						<PlanLedger
							counts={counts}
							fileName={dataset.fileName}
							ruleMatches={ruleMatches}
							ruleCount={ruleCount}
							cost={format.number(estimateCostUsd(counts.toEvaluate), {
								style: 'currency',
								currency: 'USD',
								maximumFractionDigits: COST_FRACTION_DIGITS
							})}
							duration={estimateRunDuration({ newChecks: counts.toEvaluate, pairsPerSecond })}
							splink={splink}
							entityType={entityTypeOf(workspace.evaluation.entityType)}
							isUsingDefaultRules={
								'isUsingDefaultRules' in plan && plan.isUsingDefaultRules === true
							}
							isOverLimit={counts.uniquePairs > LIMITS.maxPairsPerRun}
						/>
					)}
				</div>
				<div className="@5xl:col-span-5">
					<PlanSide
						jevFields={'config' in plan && plan.config != null ? plan.config.jevFields : []}
						counts={counts}
						threshold={workspace.evaluation.threshold}
						rulesHref={`${view.base}/rules`}
					/>
				</div>
			</div>

			<ActionBar
				back={{ href: `${view.base}/rules`, label: t('back') }}
				hint={
					blockedReason == null ? undefined : (
						<>
							<InfoIcon size={ICON_SIZE} className="shrink-0" />
							<span>{blockedReason}</span>
						</>
					)
				}
			>
				<ReadOnlyGate action="run">
					<StartRunButton
						evaluationId={id}
						pairCount={counts?.uniquePairs ?? 0}
						isDisabled={plan.blockers.length > 0}
					/>
				</ReadOnlyGate>
				{/* Read-only, starting is out of reach, so the way on is the run that exists. */}
				{view.isReadOnly && latestRun != null && (
					<Button variant="secondary" asChild>
						<Link href={`${view.base}/runs/${latestRun.id}/results?${RUNS_PARAM}=${latestRun.id}`}>
							{t('seeRun')}
							<ArrowRightIcon size={ICON_SIZE} />
						</Link>
					</Button>
				)}
			</ActionBar>
		</>
	)
}

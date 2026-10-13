import { MIN_RECORDS } from '@/lib/pairsight/entity-types'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { RUNS_PARAM } from '@/lib/pairsight/evaluation-view'
import { Button } from '@/components/ui/button'
import { PlanBlockers } from '@/components/pairsight/plan/plan-blockers'
import { PlanSummary } from '@/components/pairsight/plan/plan-summary'
import { RefreshWhile } from '@/components/pairsight/refresh-while'
import { StartRunButton } from '@/components/pairsight/start-run-button'
import { ACTION_HINT_ID, ActionBar, StepHeader } from '@/components/pairsight/step-layout'
import { AlertIcon, ArrowRightIcon, InfoIcon } from '@/components/ui/icons'
import { getJevCredentials } from '@/server/ai/jev-credentials'
import { estimateCostUsd } from '@/server/pairsight/cost'
import { estimateRunDuration } from '@/server/pairsight/run-estimate'
import { recentCheckRate } from '@/server/pairsight/run-speed'
import { LIMITS } from '@/server/pairsight/limits'
import { computePlan } from '@/server/pairsight/plan'
import { listVendors } from '@/server/pairsight/vendor-exports'
import type { LoadedWorkspace } from '@/server/pairsight/evaluation-pages'
import { ReadOnlyGate } from '@/components/pairsight/read-only'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import { parseColumnRoles } from '@/server/pairsight/json'

const ICON_SIZE = 15
// The cost to the cent: a smaller estimate says "less than a cent" rather
// than a fraction nobody needs.
const CENTS = 2
const ONE_CENT = 0.01

export async function PlanScreen({ loaded }: { loaded: LoadedWorkspace }) {
	const { workspace, view, scope } = loaded
	const id = view.evaluationId
	const [t, format] = await Promise.all([getTranslations('Plan'), getFormatter()])
	const { dataset } = workspace
	const latestRun = workspace.runs[0]
	const [plan, vendors, pairsPerSecond, jev] = await Promise.all([
		computePlan({ scope, evaluationId: id }),
		dataset == null ? Promise.resolve([]) : listVendors(id, dataset.id),
		recentCheckRate(),
		// The demo never starts a run, so it never needs a key.
		view.isReadOnly ? Promise.resolve(null) : getJevCredentials()
	])

	const counts = ('counts' in plan ? plan.counts : undefined) ?? null
	// New pairs need a Jev key to be checked: say so before Start run. A run
	// whose pairs were all checked before sends nothing, so needs none.
	const isMissingJev = !view.isReadOnly && jev == null && (counts?.toEvaluate ?? 0) > 0
	const costUsd = counts == null ? 0 : estimateCostUsd(counts.toEvaluate)
	const contributors = ('contributors' in plan ? plan.contributors : undefined) ?? []
	const splink = ('splink' in plan ? plan.splink : undefined) ?? null
	const drafts = vendors.filter((vendor) => vendor.kind === 'draft').map((vendor) => vendor.name)
	const [firstBlocker] = plan.blockers
	const blockedReason =
		firstBlocker == null
			? isMissingJev
				? t('blockedNoJev')
				: null
			: firstBlocker === 'too_many_pairs'
				? t('blockedOver', { count: (counts?.uniquePairs ?? 0) - LIMITS.maxPairsPerRun })
				: t(firstBlocker, { min: MIN_RECORDS })

	return (
		<>
			<StepHeader step="plan" title={t('title')} description={t('description')} />
			{/* Splink is still looking: the plan fills in by itself when it's done. */}
			<RefreshWhile isActive={splink?.state === 'waiting'} />

			{drafts.length > 0 && (
				<p className="bg-warning-subtle text-warning type-ui mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm p-3">
					<AlertIcon size={ICON_SIZE} className="shrink-0" />
					<span>{t('draftsNotice', { names: drafts.join(', '), count: drafts.length })}</span>
					<Link
						href={`${view.base}/vendors`}
						className="hit-area inline-flex items-center gap-1 font-medium hover:underline"
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
						uniquePairs={counts?.uniquePairs ?? 0}
						maxPairsPerRun={LIMITS.maxPairsPerRun}
					/>
				</div>
			)}

			{counts != null && dataset != null && splink != null && (
				<PlanSummary
					base={view.base}
					counts={counts}
					entityType={entityTypeOf(workspace.evaluation.entityType)}
					fileName={dataset.fileName}
					vendors={vendors
						.filter((vendor) => vendor.kind === 'export')
						.map((vendor) => ({ id: vendor.id, name: vendor.name, pairs: vendor.pairCount ?? 0 }))}
					identitySame={workspace.evaluation.identitySame}
					jevFieldCount={'config' in plan && plan.config != null ? plan.config.jevFields.length : 0}
					// The record ID, then every other column the file has.
					columnCount={1 + Object.keys(parseColumnRoles(dataset.columnRoles)).length}
					threshold={workspace.evaluation.threshold}
					cost={
						costUsd < ONE_CENT
							? t('runCostUnderCent')
							: t('runCostValue', {
									cost: format.number(costUsd, {
										style: 'currency',
										currency: 'USD',
										minimumFractionDigits: CENTS,
										maximumFractionDigits: CENTS
									})
								})
					}
					duration={estimateRunDuration({ newChecks: counts.toEvaluate, pairsPerSecond })}
					splink={splink}
					isOverLimit={counts.uniquePairs > LIMITS.maxPairsPerRun}
					start={
						<>
							<ReadOnlyGate action="run">
								<StartRunButton
									evaluationId={id}
									pairCount={counts.uniquePairs}
									isDisabled={plan.blockers.length > 0 || isMissingJev}
									describedBy={blockedReason == null ? undefined : ACTION_HINT_ID}
								/>
							</ReadOnlyGate>
							{/* Read-only, starting is out of reach, so the way on is the run that exists. */}
							{view.isReadOnly && latestRun != null && (
								<Button
									variant="secondary"
									className="bg-on-inverse text-inverse border-on-inverse hover:bg-on-inverse/90 min-h-13"
									asChild
								>
									<Link
										href={`${view.base}/runs/${latestRun.id}/results?${RUNS_PARAM}=${latestRun.id}`}
									>
										{t('seeRun')}
										<ArrowRightIcon size={ICON_SIZE} />
									</Link>
								</Button>
							)}
						</>
					}
				/>
			)}
			{view.isReadOnly && latestRun != null && (
				<p className="text-text-muted mt-5 text-sm">
					{t('demoFinished', {
						date: format.dateTime(latestRun.createdAt, { dateStyle: 'medium' })
					})}
				</p>
			)}

			<ActionBar
				back={{ href: `${view.base}/rules`, label: t('back') }}
				hint={
					blockedReason == null ? undefined : (
						<>
							<InfoIcon size={ICON_SIZE} className="shrink-0" />
							<span>
								{blockedReason}
								{firstBlocker == null && isMissingJev && (
									<>
										{' '}
										<Link
											href="/settings"
											className="text-text decoration-border-strong hover:decoration-text underline underline-offset-[3px]"
										>
											{t('blockedNoJevLink')}
										</Link>
									</>
								)}
							</span>
						</>
					)
				}
			/>
		</>
	)
}

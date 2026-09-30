import { getFormatter, getTranslations } from 'next-intl/server'
import { ActionBar, Section, StepHeader } from '@/components/pairsight/step-layout'
import { StartRunButton } from '@/components/pairsight/start-run-button'
import { AlertIcon, InfoIcon } from '@/components/ui/icons'
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
	const counts = 'counts' in plan ? plan.counts : null
	const number = (value: number) => format.number(value)
	const reduction =
		counts == null || counts.allPossiblePairs === 0
			? 0
			: Math.max(0, Math.round((1 - counts.uniquePairs / counts.allPossiblePairs) * 100))
	const rows: Array<[string, string, boolean?]> =
		counts == null
			? []
			: [
					[t('records'), number(counts.records)],
					[t('blocked'), number(counts.blockedPairs)],
					[t('vendorPairs'), number(counts.vendorPairs)],
					[t('addedByVendor'), number(counts.addedByVendorOnly)],
					[t('unique'), number(counts.uniquePairs), true],
					[t('reusable'), number(counts.reusable)],
					[t('toEvaluate'), number(counts.toEvaluate), true]
				]
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
				<Section title={t('unique')}>
					<dl className="divide-border divide-y">
						{rows.map(([label, value, isEmphasis]) => (
							<div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
								<dt
									className={
										isEmphasis ? 'text-text text-sm font-semibold' : 'text-text-muted text-sm'
									}
								>
									{label}
								</dt>
								<dd
									className={
										isEmphasis
											? 'text-text text-base font-semibold tabular-nums'
											: 'text-text text-sm tabular-nums'
									}
								>
									{value}
								</dd>
							</div>
						))}
					</dl>
					{counts != null && (
						<p className="text-text-muted mt-3 text-xs">
							{t('reduction', { percent: reduction, all: number(counts.allPossiblePairs) })} ·{' '}
							{t('limit', { limit: number(LIMITS.maxPairsPerRun) })}
						</p>
					)}
				</Section>
				<div className="flex flex-col gap-6">
					<Section title={t('jevReceivesTitle')}>
						<p className="text-text text-sm">
							{t('jevReceives', {
								fields:
									'config' in plan && plan.config != null
										? plan.config.jevFields.map((field) => tRoles(field)).join(', ')
										: '—'
							})}
						</p>
						{counts != null && (
							<p className="text-text-muted mt-3 text-xs">
								{t('cost', {
									cost: format.number(estimateCostUsd(counts.toEvaluate), {
										style: 'currency',
										currency: 'USD',
										maximumFractionDigits: 4
									})
								})}
							</p>
						)}
						<p className="text-text-muted mt-2 flex items-center gap-1.5 text-xs">
							<InfoIcon />
							{t('fictionalOnly')}
						</p>
					</Section>
					{plan.blockers.length > 0 && (
						<div role="alert" className="border-danger/40 bg-danger-subtle rounded-lg border p-4">
							<p className="text-danger flex items-center gap-2 text-sm font-semibold">
								<AlertIcon />
								{t('blockerTitle')}
							</p>
							<ul className="text-text mt-2 ml-6 list-disc space-y-1 text-sm">
								{plan.blockers.map((blocker) => (
									<li key={blocker}>
										{blocker === 'too_many_pairs'
											? t('too_many_pairs', {
													count: number(counts?.uniquePairs ?? 0),
													limit: number(LIMITS.maxPairsPerRun)
												})
											: t(blocker)}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
			<ActionBar>
				<StartRunButton evaluationId={id} isDisabled={plan.blockers.length > 0} />
			</ActionBar>
		</>
	)
}

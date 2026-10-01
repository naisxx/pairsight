import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ArrowRightIcon, WarningCircleIcon } from '@/components/ui/icons'
import type { PlanBlocker, PlanContributor } from '@/server/pairsight/plan'
import { ruleLabel } from '../rule-label'
import { TurnOffRuleButton } from './turn-off-rule-button'

const ICON_SIZE = 17
const LINK_ICON_SIZE = 13

// Why the run can't start. Over the pair limit, it lists where the pairs come
// from, largest first, each rule with a Turn off; vendor-matched pairs always
// stay in. Any other blocker is listed as what to fix.
export async function PlanBlockers({
	evaluationId,
	blockers,
	contributors,
	rules,
	uniquePairs,
	maxPairsPerRun
}: {
	evaluationId: string
	blockers: readonly PlanBlocker[]
	contributors: readonly PlanContributor[]
	rules: Array<{ id: string; fields: string[] }>
	uniquePairs: number
	maxPairsPerRun: number
}) {
	const [t, tRules, tRoles] = await Promise.all([
		getTranslations('Plan'),
		getTranslations('Rules'),
		getTranslations('Roles')
	])
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const isOver = blockers.includes('too_many_pairs')
	const others = blockers.filter((blocker) => blocker !== 'too_many_pairs')
	return (
		<div className="space-y-4">
			{isOver && (
				<section role="alert" className="border-danger bg-danger-subtle rounded-md border p-4">
					<h2 className="text-danger flex items-center gap-2 text-sm font-semibold">
						<WarningCircleIcon size={ICON_SIZE} />
						{t('overTitle', { total: uniquePairs, limit: maxPairsPerRun })}
					</h2>
					<p className="type-ui text-text mt-1">
						{t('overDescription', { count: uniquePairs - maxPairsPerRun })}
					</p>
					<ul className="divide-border border-border bg-surface mt-3 divide-y overflow-hidden rounded-sm border">
						{contributors.map((item) =>
							item.kind === 'rule' ? (
								<li
									key={item.ruleId}
									className="type-ui flex flex-wrap items-center gap-3 px-3 py-2"
								>
									<span className="font-medium">
										{ruleLabel({ ruleId: item.ruleId, rules, tRules, tRoles })}
									</span>
									<span className="text-text-muted">
										{t.rich('overRule', {
											pairs: item.pairCount,
											largest: item.largestBucket,
											n: mono
										})}
									</span>
									<TurnOffRuleButton
										evaluationId={evaluationId}
										ruleId={item.ruleId}
										label={ruleLabel({ ruleId: item.ruleId, rules, tRules, tRoles })}
									/>
								</li>
							) : (
								<li key="vendors" className="type-ui flex flex-wrap items-center gap-3 px-3 py-2">
									<span className="font-medium">{t('overVendors')}</span>
									<span className="text-text-muted">
										{t.rich('overVendorsNote', { pairs: item.pairCount, n: mono })}
									</span>
								</li>
							)
						)}
					</ul>
					<p className="text-text-muted mt-2 text-xs">{t('overNote')}</p>
					<div className="type-ui mt-3 flex flex-wrap gap-x-4 gap-y-1">
						<Link
							href={`/evaluations/${evaluationId}/rules`}
							className="text-accent-ink inline-flex items-center gap-1 font-medium hover:underline"
						>
							{t('editRules')}
							<ArrowRightIcon size={LINK_ICON_SIZE} />
						</Link>
						<Link
							href={`/evaluations/${evaluationId}/records`}
							className="text-accent-ink font-medium hover:underline"
						>
							{t('fixRecords')}
						</Link>
					</div>
				</section>
			)}
			{others.length > 0 && (
				<section role="alert" className="border-danger bg-danger-subtle rounded-md border p-4">
					<h2 className="text-danger flex items-center gap-2 text-sm font-semibold">
						<WarningCircleIcon size={ICON_SIZE} />
						{t('blockerTitle')}
					</h2>
					<ul className="type-ui text-text mt-2 ml-6 list-disc space-y-1">
						{others.map((blocker) => (
							<li key={blocker}>{t(blocker)}</li>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}

import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { AlertIcon } from '@/components/ui/icons'
import type { PlanBlocker, PlanContributor } from '@/server/pairsight/plan'
import { ruleLabel } from '../rule-label'

// Why the run can't start. An over-cap plan also says where its pairs come
// from, largest first, and links to the two fixes: narrow the rules or
// shrink the input.
export async function PlanBlockers({
	evaluationId,
	blockers,
	contributors,
	uniquePairs,
	maxPairsPerRun
}: {
	evaluationId: string
	blockers: readonly PlanBlocker[]
	contributors: readonly PlanContributor[]
	uniquePairs: number
	maxPairsPerRun: number
}) {
	const [t, tRules, tRoles, format] = await Promise.all([
		getTranslations('Plan'),
		getTranslations('Rules'),
		getTranslations('Roles'),
		getFormatter()
	])
	const number = (value: number) => format.number(value)
	const isOverCap = blockers.includes('too_many_pairs')
	const rules = contributors.flatMap((item) =>
		item.kind === 'rule' ? [{ id: item.ruleId, fields: [...item.fields] }] : []
	)
	return (
		<div role="alert" className="border-danger/40 bg-danger-subtle rounded-lg border p-4">
			<p className="text-danger flex items-center gap-2 text-sm font-semibold">
				<AlertIcon />
				{t('blockerTitle')}
			</p>
			<ul className="text-text mt-2 ml-6 list-disc space-y-1 text-sm">
				{blockers.map((blocker) => (
					<li key={blocker}>
						{blocker === 'too_many_pairs'
							? t('too_many_pairs', { count: number(uniquePairs), limit: number(maxPairsPerRun) })
							: t(blocker)}
					</li>
				))}
			</ul>
			{isOverCap && contributors.length > 0 && (
				<div className="mt-4 flex flex-col gap-2">
					<p className="text-text text-sm font-semibold">{t('causesTitle')}</p>
					<ul className="text-text flex flex-col gap-1 text-sm tabular-nums">
						{contributors.map((item) => (
							<li key={item.kind === 'rule' ? item.ruleId : 'vendors'}>
								{item.kind === 'rule'
									? t('causeRule', {
											rule: ruleLabel({ ruleId: item.ruleId, rules, tRules, tRoles }),
											pairs: number(item.pairCount),
											largest: number(item.largestBucket)
										})
									: t('causeVendors', { pairs: number(item.pairCount) })}
							</li>
						))}
					</ul>
					<p className="text-text-muted text-xs">{t('causesNote')}</p>
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
						<Link
							href={`/evaluations/${evaluationId}/rules`}
							className="text-accent-ink font-medium hover:underline"
						>
							{t('fixRules')}
						</Link>
						<Link
							href={`/evaluations/${evaluationId}/records`}
							className="text-accent-ink font-medium hover:underline"
						>
							{t('fixRecords')}
						</Link>
					</div>
				</div>
			)}
		</div>
	)
}

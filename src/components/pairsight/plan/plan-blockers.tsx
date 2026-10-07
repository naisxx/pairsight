import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ArrowRightIcon, WarningCircleIcon } from '@/components/ui/icons'
import type { PlanBlocker, PlanContributor } from '@/server/pairsight/plan'
import { ReadOnlyGate } from '../read-only'
import { RetrySuggestionsButton } from './retry-suggestions-button'

const ICON_SIZE = 17
const LINK_ICON_SIZE = 13

// Why the run can't start. Over the pair limit, it says where the pairs come
// from, largest first. Any other blocker is listed as what to fix; when
// PairSight couldn't work out the pairs, with a way to try again.
export async function PlanBlockers({
	base,
	evaluationId,
	blockers,
	contributors,
	uniquePairs,
	maxPairsPerRun
}: {
	// The evaluation's pages, for the fix links.
	base: string
	evaluationId: string
	blockers: readonly PlanBlocker[]
	contributors: readonly PlanContributor[]
	uniquePairs: number
	maxPairsPerRun: number
}) {
	const t = await getTranslations('Plan')
	const mono = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>
	const isOver = blockers.includes('too_many_pairs')
	// Still suggesting isn't a problem to fix: Start just waits (plan-screen.tsx).
	const others = blockers.filter(
		(blocker) => blocker !== 'too_many_pairs' && blocker !== 'still_suggesting'
	)
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
						{contributors.map((item) => (
							<li key={item.kind} className="type-ui flex flex-wrap items-center gap-3 px-3 py-2">
								<span className="font-medium">
									{item.kind === 'vendors' ? t('overVendors') : t('overSuggested')}
								</span>
								<span className="text-text-muted">
									{t.rich(item.kind === 'vendors' ? 'overVendorsNote' : 'overSuggestedNote', {
										pairs: item.pairCount,
										n: mono
									})}
								</span>
							</li>
						))}
					</ul>
					<div className="type-ui mt-3 flex flex-wrap gap-x-4 gap-y-1">
						<Link
							href={`${base}/records`}
							className="text-accent-ink inline-flex items-center gap-1 font-medium hover:underline"
						>
							{t('fixRecords')}
							<ArrowRightIcon size={LINK_ICON_SIZE} />
						</Link>
						<Link href={`${base}/vendors`} className="text-accent-ink font-medium hover:underline">
							{t('fixVendors')}
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
							<li key={blocker}>
								<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
									{t(blocker)}
									{blocker === 'suggestions_failed' && (
										<ReadOnlyGate action="retry">
											<RetrySuggestionsButton evaluationId={evaluationId} />
										</ReadOnlyGate>
									)}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}

import { getTranslations } from 'next-intl/server'
import { ContinueSetup } from '@/components/pairsight/evaluations/continue-setup'
import { EmptyEvaluations } from '@/components/pairsight/evaluations/empty-evaluations'
import { EvaluationsTable } from '@/components/pairsight/evaluations/evaluations-table'
import { LatestResults } from '@/components/pairsight/evaluations/latest-results'
import { AnimatedCount } from '@/components/ui/animated-number'
import { Reveal } from '@/components/ui/reveal'
import { cn } from '@/lib/cn'
import type { Dashboard } from '@/server/pairsight/dashboard'

// Evaluations still in setup shown to pick up: the newest few, so the card
// stays the size of the latest results beside it.
const CONTINUE_SHOWN = 3

// The evaluations dashboard: the header (greeting and New evaluation, or the
// sandbox's introduction), the summary strip, the latest results, what's
// still in setup and every evaluation. Read-only in the sandbox: no create,
// rename or delete.
export async function DashboardScreen({
	dashboard,
	header,
	isReadOnly
}: {
	dashboard: Dashboard
	header: React.ReactNode
	isReadOnly: boolean
}) {
	const t = await getTranslations('Evaluations')
	const { rows, stats, latest } = dashboard
	const names = rows.map((row) => row.name)
	const statItems = [
		{ label: t('statEvaluations'), value: stats.evaluations },
		{ label: t('statWithResults'), value: stats.withResults },
		{ label: t('statInSetup'), value: stats.inSetup },
		{ label: t('statPairsAssessed'), value: stats.pairsAssessed }
	]

	return (
		<>
			{header}
			{rows.length === 0 ? (
				<EmptyEvaluations />
			) : (
				<>
					<Reveal index={0}>
						<dl
							aria-label={t('statsLabel')}
							className="border-border mt-2 grid grid-cols-2 gap-x-6 gap-y-5 border-b pb-7 @2xl:grid-cols-4"
						>
							{statItems.map((item) => (
								<div key={item.label}>
									<dt className="text-text-muted type-ui">{item.label}</dt>
									<dd className="mt-1.5">
										<AnimatedCount
											value={item.value}
											className="font-mono text-3xl leading-none font-medium tracking-[-0.03em]"
										/>
									</dd>
								</div>
							))}
						</dl>
					</Reveal>

					<div className="mt-7 grid grid-cols-1 gap-4 @5xl:grid-cols-12">
						{latest != null && (
							<Reveal index={1} className="@5xl:col-span-8">
								<LatestResults latest={latest} />
							</Reveal>
						)}
						<Reveal
							index={2}
							className={cn(latest != null ? '@5xl:col-span-4' : '@5xl:col-span-12')}
						>
							<ContinueSetup
								total={rows.filter((row) => row.status !== 'complete').length}
								rows={rows
									.filter((row) => row.status !== 'complete')
									.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
									.slice(0, CONTINUE_SHOWN)}
								takenNames={names}
								isReadOnly={isReadOnly}
							/>
						</Reveal>
					</div>

					<Reveal index={3}>
						<EvaluationsTable
							isReadOnly={isReadOnly}
							rows={rows.map((row) => ({
								id: row.id,
								href: row.href,
								name: row.name,
								entityType: row.entityType,
								createdAt: row.createdAt,
								updatedAt: row.updatedAt,
								status: row.status,
								stages: row.stages,
								nextKey: row.next?.key ?? null,
								recordCount: row.recordCount,
								vendorCount: row.vendorCount,
								lastRunAt: row.lastRun?.createdAt ?? null
							}))}
						/>
					</Reveal>
				</>
			)}
		</>
	)
}

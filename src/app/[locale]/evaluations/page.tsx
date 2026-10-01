import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { ContinueSetup } from '@/components/pairsight/evaluations/continue-setup'
import { EmptyEvaluations } from '@/components/pairsight/evaluations/empty-evaluations'
import { EvaluationsTable } from '@/components/pairsight/evaluations/evaluations-table'
import { Greeting } from '@/components/pairsight/evaluations/greeting'
import { LatestResults } from '@/components/pairsight/evaluations/latest-results'
import { NewEvaluationButton } from '@/components/pairsight/evaluations/new-evaluation-button'
import { AnimatedCount } from '@/components/ui/animated-number'
import { Reveal } from '@/components/ui/reveal'
import { cn } from '@/lib/cn'
import { requireUserOrRedirect } from '@/server/auth/session'
import { getDashboard } from '@/server/pairsight/dashboard'

export default async function EvaluationsPage() {
	const user = await requireUserOrRedirect('/evaluations')
	const [t, tShell, dashboard] = await Promise.all([
		getTranslations('Evaluations'),
		getTranslations('Shell'),
		getDashboard(user.id)
	])
	const { rows, stats, latest } = dashboard
	const names = rows.map((row) => row.name)
	const firstName = user.name.split(/\s+/)[0] ?? user.name
	const statItems = [
		{ label: t('statEvaluations'), value: stats.evaluations },
		{ label: t('statWithResults'), value: stats.withResults },
		{ label: t('statInSetup'), value: stats.inSetup },
		{ label: t('statPairsAssessed'), value: stats.pairsAssessed }
	]

	return (
		<AppShell email={user.email} name={user.name} crumbs={[{ label: tShell('evaluations') }]}>
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<Greeting firstName={firstName} />
					<h1 className="type-title mt-0.5">{t('title')}</h1>
				</div>
				{rows.length > 0 && <NewEvaluationButton takenNames={names} />}
			</header>

			{rows.length === 0 ? (
				<EmptyEvaluations />
			) : (
				<>
					<Reveal index={0}>
						<dl
							aria-label={t('statsLabel')}
							className="border-border bg-surface sm:divide-border mt-5 grid grid-cols-2 gap-y-3 rounded-md border py-3 sm:grid-cols-4 sm:divide-x"
						>
							{statItems.map((item) => (
								<div key={item.label} className="px-4">
									<dt className="text-text-muted text-xs">{item.label}</dt>
									<dd className="mt-0.5">
										<AnimatedCount
											value={item.value}
											className="font-mono text-[20px] leading-none font-medium"
										/>
									</dd>
								</div>
							))}
						</dl>
					</Reveal>

					<div className="mt-4 grid gap-4 lg:grid-cols-12">
						{latest != null && (
							<Reveal index={1} className="lg:col-span-8">
								<LatestResults latest={latest} />
							</Reveal>
						)}
						<Reveal index={2} className={cn(latest != null ? 'lg:col-span-4' : 'lg:col-span-12')}>
							<ContinueSetup
								rows={rows.filter((row) => row.status !== 'complete')}
								takenNames={names}
							/>
						</Reveal>
					</div>

					<Reveal index={3}>
						<EvaluationsTable
							rows={rows.map((row) => ({
								id: row.id,
								name: row.name,
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
		</AppShell>
	)
}

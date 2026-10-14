import { getTranslations } from 'next-intl/server'
import { ContinueSetup } from '@/components/pairsight/evaluations/continue-setup'
import { EmptyEvaluations } from '@/components/pairsight/evaluations/empty-evaluations'
import { EvaluationCard } from '@/components/pairsight/evaluations/evaluation-card'
import { EvaluationsTable } from '@/components/pairsight/evaluations/evaluations-table'
import {
	HideIfDeleting,
	PendingDeletesProvider
} from '@/components/pairsight/evaluations/pending-deletes'
import { Glyph } from '@/components/pairsight/glyph'
import { AnimatedCount } from '@/components/ui/animated-number'
import { Reveal } from '@/components/ui/reveal'
import type { Dashboard } from '@/server/pairsight/dashboard'
import { demoPreview } from '@/server/pairsight/demo-preview'

// Evaluations still in setup shown to pick up: the newest few.
const CONTINUE_SHOWN = 3

// The dashboard's heading (pairsight-handoff Home): an eyebrow, the
// two-line headline (what's finished, then what's next) and a lead under it.
// Beside it, the page's own action (New evaluation).
export function DashboardHeader({
	eyebrow,
	title,
	subtitle,
	lead,
	action
}: {
	eyebrow: React.ReactNode
	title: string
	subtitle: string
	lead: React.ReactNode
	action?: React.ReactNode
}) {
	return (
		<header className="flex flex-wrap items-end justify-between gap-6 pt-4">
			<div className="max-w-[900px] min-w-0">
				<p className="text-text-muted type-eyebrow flex items-center">
					<Glyph kind="same" className="mr-2.5" />
					{eyebrow}
				</p>
				<h1 className="font-display mt-5 text-[clamp(2.5rem,4.6vw,4rem)] leading-[1.05] font-semibold tracking-[-0.025em] text-balance">
					{title}
					<br />
					<span className="text-text-muted">{subtitle}</span>
				</h1>
				<div className="text-text-body mt-5 max-w-[640px] text-[1.1875rem] leading-[1.875rem]">
					{lead}
				</div>
			</div>
			{action}
		</header>
	)
}

// The evaluations dashboard: the header, the newest finished evaluations as
// cards, then, for an owner, what's still in setup and every evaluation; for
// the sandbox, the way to an account. Read-only in the sandbox: no create,
// rename or delete.
export async function DashboardScreen({
	dashboard,
	header,
	isReadOnly,
	closer
}: {
	dashboard: Dashboard
	header: React.ReactNode
	isReadOnly: boolean
	// After the cards: the sandbox's call to try it on your own records.
	closer?: React.ReactNode
}) {
	const t = await getTranslations('Evaluations')
	const { rows, finished } = dashboard
	const names = rows.map((row) => row.name)
	const unfinished = rows.filter((row) => row.status !== 'complete')

	return (
		<>
			{header}
			{rows.length === 0 ? (
				// What Results looks like, from the demo's real run (built once, at load).
				<EmptyEvaluations previewVendors={await demoPreview()} />
			) : (
				// One evaluation being deleted leaves every card and row at once.
				<PendingDeletesProvider>
					{finished.length > 0 && (
						<Reveal index={0} className="mt-12">
							<div className="flex flex-wrap gap-4">
								{finished.map((evaluation) => (
									<HideIfDeleting key={evaluation.evaluationId} id={evaluation.evaluationId}>
										<EvaluationCard evaluation={evaluation} />
									</HideIfDeleting>
								))}
							</div>
							<p className="text-text-muted mt-5 text-sm">{t('scoresNote')}</p>
						</Reveal>
					)}

					{/* The sandbox's evaluations are all finished and fixed: nothing to pick up or manage. */}
					{!isReadOnly && (
						<>
							<Reveal index={1} className="mt-14">
								<ContinueSetup
									total={unfinished.length}
									rows={unfinished
										.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
										.slice(0, CONTINUE_SHOWN)}
									takenNames={names}
									isReadOnly={isReadOnly}
								/>
							</Reveal>
							<Reveal index={2}>
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
				</PendingDeletesProvider>
			)}
			{closer}
		</>
	)
}

// The owner's headline counts, as a line under the heading.
export async function DashboardStats({ stats }: { stats: Dashboard['stats'] }) {
	const t = await getTranslations('Evaluations')
	const items = [
		{ label: t('statEvaluations'), value: stats.evaluations },
		{ label: t('statWithResults'), value: stats.withResults },
		{ label: t('statInSetup'), value: stats.inSetup },
		{ label: t('statPairsAssessed'), value: stats.pairsAssessed }
	]
	return (
		<dl aria-label={t('statsLabel')} className="flex flex-wrap gap-x-8 gap-y-3">
			{items.map((item) => (
				<div key={item.label}>
					<dt className="text-text-muted type-eyebrow">{item.label}</dt>
					<dd className="mt-1">
						<AnimatedCount
							value={item.value}
							className="text-text font-mono text-2xl leading-none font-semibold tracking-[-0.03em]"
						/>
					</dd>
				</div>
			))}
		</dl>
	)
}

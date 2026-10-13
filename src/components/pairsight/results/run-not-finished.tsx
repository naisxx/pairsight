import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Count } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'
import { PAUSED, type RunProgress } from '@/server/pairsight/runs'
import { OpenRunsButton } from './open-runs-button'

const PERCENT = 100

// Results for a run that isn't finished: how far it got and what to do next,
// but no numbers. Pairs are checked in no particular order, so a half-done
// run's scores could point the wrong way; they appear once every pair is
// checked. The page refreshes itself when the run finishes (the Runs centre
// is watching it). Built from the system (no design): the headline where the
// verdict will be, and the run's progress on the dark card the Check and
// start page uses for the run.
export async function RunNotFinished({
	runId,
	progress,
	lastFinished
}: {
	runId: string
	progress: RunProgress
	// The newest finished run of this evaluation, to look at meanwhile.
	lastFinished: { number: number; href: string } | null
}) {
	const t = await getTranslations('Results')
	const done = progress.succeeded + progress.failed
	const percent = progress.total === 0 ? 0 : Math.round((done / progress.total) * PERCENT)
	const state =
		progress.status === 'running'
			? 'running'
			: progress.stopReason === PAUSED
				? 'paused'
				: 'stopped'

	return (
		<section aria-labelledby="run-not-finished" className="mt-5">
			<h1
				id="run-not-finished"
				className="rise font-display max-w-[880px] text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.025em]"
			>
				{t(`notFinishedTitle_${state}`)}
			</h1>
			<p className="rise stagger-1 text-text-body mt-3 max-w-[640px] text-base">
				{t(`notFinishedBody_${state}`)}
			</p>
			<div className="rise stagger-2 bg-inverse text-on-inverse border-inverse mt-9 max-w-[640px] rounded-lg border p-6 md:p-7">
				<div className="flex items-baseline justify-between gap-4">
					<h2 className="type-eyebrow opacity-70">{t('notFinishedProgressLabel')}</h2>
					<span className="font-mono text-sm font-semibold">{percent}%</span>
				</div>
				<p className="mt-3.5">
					<Count
						value={done}
						className="mr-1.5 font-mono text-[3.5rem] leading-none font-semibold tracking-[-0.03em]"
					/>
					{t('notFinishedOf', { total: progress.total }, EXACT_FORMATS)}
				</p>
				<div
					role="progressbar"
					aria-label={t('notFinishedProgressLabel')}
					aria-valuenow={done}
					aria-valuemin={0}
					aria-valuemax={progress.total}
					className="bg-on-inverse/20 mt-5 h-1.5 overflow-hidden rounded-full"
				>
					<div className="bg-brand h-full rounded-full" style={{ width: `${percent}%` }} />
				</div>
				<p className="mt-5 text-sm opacity-75">{t('notFinishedWhy')}</p>
			</div>
			<div className="rise stagger-3 mt-6 flex flex-wrap gap-3">
				<OpenRunsButton runId={runId} />
				{lastFinished != null && (
					<Button asChild variant="secondary">
						<Link href={lastFinished.href}>
							{t('notFinishedLastRun', { number: lastFinished.number })}
						</Link>
					</Button>
				)}
			</div>
		</section>
	)
}

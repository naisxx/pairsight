import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { PAUSED, type RunProgress } from '@/server/pairsight/runs'
import { OpenRunsButton } from './open-runs-button'

const PERCENT = 100
const ICON_SIZE = 15

// Results for a run that isn't finished: how far it got and what to do next,
// but no numbers. Pairs are checked in no particular order, so a half-done
// run's scores could point the wrong way; they appear once every pair is
// checked. The page refreshes itself when the run finishes (the Runs centre
// is watching it).
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
		<section
			aria-labelledby="run-not-finished"
			className="border-border bg-surface mt-6 max-w-2xl rounded-lg border p-6"
		>
			<h2 id="run-not-finished" className="type-subheading">
				{t(`notFinishedTitle_${state}`)}
			</h2>
			<p className="text-text-muted type-ui mt-1 leading-relaxed">
				{t(`notFinishedBody_${state}`)}
			</p>
			<div className="mt-4">
				<p className="type-ui">
					{t.rich('notFinishedProgress', {
						done,
						total: progress.total,
						n: (chunks) => <span className="font-mono">{chunks}</span>
					})}
				</p>
				<div
					role="progressbar"
					aria-label={t('notFinishedProgressLabel')}
					aria-valuenow={done}
					aria-valuemin={0}
					aria-valuemax={progress.total}
					className="bg-border mt-2 h-1.5 overflow-hidden rounded-full"
				>
					<div className="bg-action h-full rounded-full" style={{ width: `${percent}%` }} />
				</div>
			</div>
			<p className="text-text-muted mt-4 text-xs leading-relaxed">{t('notFinishedWhy')}</p>
			<div className="mt-5 flex flex-wrap gap-2">
				<OpenRunsButton runId={runId} />
				{lastFinished != null && (
					<Button asChild variant="secondary" size="sm">
						<Link href={lastFinished.href}>
							{t('notFinishedLastRun', { number: lastFinished.number })}
							<ArrowRightIcon size={ICON_SIZE} />
						</Link>
					</Button>
				)}
			</div>
		</section>
	)
}

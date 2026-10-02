import { getTranslations } from 'next-intl/server'
import { RunProgress } from '@/components/pairsight/run/run-progress'
import { StepHeader } from '@/components/pairsight/step-layout'
import type { loadRun } from '@/server/pairsight/evaluation-pages'
import { getRunProgress } from '@/server/pairsight/runs'

export async function RunScreen({ loaded }: { loaded: Awaited<ReturnType<typeof loadRun>> }) {
	const { run, view, base } = loaded
	const [t, progress] = await Promise.all([getTranslations('Run'), getRunProgress(run.id)])
	return (
		<>
			<StepHeader title={t('title', { number: run.number })} description={t('description')} />
			<RunProgress
				runId={run.id}
				resultsHref={`${base}/results`}
				backHref={`${view.base}/plan`}
				initial={progress}
				startedAt={run.createdAt}
				completedAt={run.completedAt}
			/>
		</>
	)
}

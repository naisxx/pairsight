import { getTranslations } from 'next-intl/server'
import { RunProgress } from '@/components/pairsight/run/run-progress'
import { StepHeader } from '@/components/pairsight/step-layout'
import { getRunProgress } from '@/server/pairsight/runs'
import { loadRun } from './run'

export default async function RunPage({
	params
}: {
	params: Promise<{ id: string; runId: string }>
}) {
	const { id, runId } = await params
	const [{ run }, t] = await Promise.all([
		loadRun({ id, runId, path: `/evaluations/${id}/runs/${runId}` }),
		getTranslations('Run')
	])
	const progress = await getRunProgress(run.id)
	return (
		<>
			<StepHeader title={t('title', { number: run.number })} description={t('description')} />
			<RunProgress
				runId={run.id}
				resultsHref={`/evaluations/${id}/runs/${run.id}/results`}
				initial={progress}
			/>
		</>
	)
}

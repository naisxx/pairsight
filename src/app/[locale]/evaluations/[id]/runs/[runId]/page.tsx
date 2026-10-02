import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { RUNS_PARAM } from '@/lib/pairsight/evaluation-view'
import { loadRun } from '@/server/pairsight/evaluation-pages'

// A run's old page: its results, with the Runs centre open on it.
export default async function RunPage({
	params
}: {
	params: Promise<{ id: string; runId: string }>
}) {
	const { id, runId } = await params
	const [{ base }, locale] = await Promise.all([
		loadRun({ kind: 'owner', id, path: `/evaluations/${id}/runs/${runId}` }, runId),
		getLocale()
	])
	return redirect({ href: `${base}/results?${RUNS_PARAM}=${runId}`, locale })
}

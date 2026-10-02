import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { RUNS_PARAM } from '@/lib/pairsight/evaluation-view'
import { loadRun, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

// The prepared run's old page: its results, with the Runs centre open on it.
export default async function SandboxRunPage({ params }: { params: Promise<{ runId: string }> }) {
	const { runId } = await params
	const [{ base }, locale] = await Promise.all([loadRun(SANDBOX_TARGET, runId), getLocale()])
	return redirect({ href: `${base}/results?${RUNS_PARAM}=${runId}`, locale })
}

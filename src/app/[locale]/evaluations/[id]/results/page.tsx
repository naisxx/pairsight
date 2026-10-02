import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { loadWorkspace, stageOrLandingHref } from '@/server/pairsight/evaluation-pages'

// Results lives under a run (/runs/[runId]). This address opens the latest run's
// page, or, before there is one, wherever the evaluation is up to.
export default async function ResultsStagePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace({ kind: 'owner', id, path: `/evaluations/${id}/results` }),
		getLocale()
	])
	return redirect({
		href: stageOrLandingHref(view, workspace, 'results'),
		locale
	})
}

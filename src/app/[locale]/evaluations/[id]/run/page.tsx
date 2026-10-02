import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { loadWorkspace, stageOrLandingHref } from '@/server/pairsight/evaluation-pages'

// Runs aren't a step any more (they're in the Runs centre). This old address
// opens the latest run's results, or wherever the evaluation is up to.
export default async function RunStagePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace({ kind: 'owner', id, path: `/evaluations/${id}/run` }),
		getLocale()
	])
	return redirect({ href: stageOrLandingHref(view, workspace, 'results'), locale })
}

import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import {
	loadWorkspace,
	sandboxTarget,
	stageOrLandingHref
} from '@/server/pairsight/evaluation-pages'

// The old run step: the prepared run's results.
export default async function SandboxRunStagePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace(sandboxTarget(id)),
		getLocale()
	])
	return redirect({ href: stageOrLandingHref(view, workspace, 'results'), locale })
}

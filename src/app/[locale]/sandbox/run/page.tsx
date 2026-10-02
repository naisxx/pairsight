import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import {
	loadWorkspace,
	SANDBOX_TARGET,
	stageOrLandingHref
} from '@/server/pairsight/evaluation-pages'

// The old run step: the prepared run's results.
export default async function SandboxRunStagePage() {
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace(SANDBOX_TARGET),
		getLocale()
	])
	return redirect({
		href: stageOrLandingHref(view, workspace, 'results'),
		locale
	})
}

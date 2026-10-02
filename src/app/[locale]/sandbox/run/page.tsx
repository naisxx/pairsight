import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import {
	loadWorkspace,
	SANDBOX_TARGET,
	stageOrLandingHref
} from '@/server/pairsight/evaluation-pages'

// The sandbox's run stage: its prepared run's page.
export default async function SandboxRunStagePage() {
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace(SANDBOX_TARGET),
		getLocale()
	])
	return redirect({
		href: stageOrLandingHref(view, workspace, 'run'),
		locale
	})
}

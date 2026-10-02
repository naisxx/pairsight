import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import {
	loadWorkspace,
	SANDBOX_TARGET,
	stageOrLandingHref
} from '@/server/pairsight/evaluation-pages'

// The sandbox's results stage: its prepared run's page.
export default async function SandboxResultsStagePage() {
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace(SANDBOX_TARGET),
		getLocale()
	])
	return redirect({
		href: stageOrLandingHref(view, workspace, 'results'),
		locale
	})
}

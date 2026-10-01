import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { landingHref, loadWorkspace, workspaceSteps } from './workspace'

// Reopening an evaluation lands where it's up to (see landingHref).
export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ workspace }, locale] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}`),
		getLocale()
	])
	return redirect({ href: landingHref(id, workspaceSteps(id, workspace)), locale })
}

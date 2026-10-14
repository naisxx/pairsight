import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { landingHref, loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'

// Opening a demo evaluation lands where it's up to, as an owner's does
// (evaluations/[id]/page.tsx). Without this page, /sandbox/<id> was no route
// at all, and a mistyped demo link got the app-wide not-found page instead
// of the demo's own (../not-found.tsx).
export default async function SandboxEvaluationPage({
	params
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace(sandboxTarget(id)),
		getLocale()
	])
	return redirect({ href: landingHref(view, workspace), locale })
}

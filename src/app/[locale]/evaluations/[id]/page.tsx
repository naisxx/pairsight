import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { landingHref, loadWorkspace } from '@/server/pairsight/evaluation-pages'

// Reopening an evaluation lands where it's up to (see landingHref).
export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ view, workspace }, locale] = await Promise.all([
		loadWorkspace({ kind: 'owner', id, path: `/evaluations/${id}` }),
		getLocale()
	])
	return redirect({ href: landingHref(view, workspace), locale })
}

import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { loadWorkspace, workspaceSteps } from './workspace'

// Reopening an evaluation lands on the first step that still needs work, or
// on the latest results once a run exists (docs/PairSight-UX-Plan.md §3).
export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ workspace }, locale] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}`),
		getLocale()
	])
	const steps = workspaceSteps(id, workspace)
	const results = steps.find((step) => step.key === 'results')
	const target =
		results != null && results.state !== 'locked'
			? results
			: (steps.find((step) => step.state === 'available') ?? steps[0])
	return redirect({ href: target?.href ?? `/evaluations/${id}/records`, locale })
}

import 'server-only'
import { notFound } from 'next/navigation'
import { isUuid } from '@/server/pairsight/schemas'
import type { Step } from '@/components/pairsight/stepper-rail'
import { AppError } from '@/lib/errors/app-error'
import { requireUserOrRedirect } from '@/server/auth/session'
import { getWorkspace } from '@/server/pairsight/workspace'

// Shared by the workspace layout and its step pages: the owner-scoped
// workspace (a foreign or malformed id is a 404) and the step states.

export async function loadWorkspace(id: string, path: string) {
	if (!isUuid(id)) notFound()
	const user = await requireUserOrRedirect(path)
	try {
		return { user, workspace: await getWorkspace({ ownerId: user.id, evaluationId: id }) }
	} catch (error) {
		if (error instanceof AppError && error.status === 404) notFound()
		throw error
	}
}

export function workspaceSteps(
	id: string,
	workspace: Awaited<ReturnType<typeof getWorkspace>>
): Step[] {
	const base = `/evaluations/${id}`
	const hasRecords = workspace.dataset != null
	const hasVendors = workspace.vendorExports.length > 0
	const latestRun = workspace.runs[0]
	return [
		{ key: 'records', href: `${base}/records`, state: hasRecords ? 'complete' : 'available' },
		{
			key: 'vendors',
			href: `${base}/vendors`,
			state: !hasRecords ? 'locked' : hasVendors ? 'complete' : 'available'
		},
		{
			key: 'rules',
			href: `${base}/rules`,
			state: !hasRecords ? 'locked' : hasVendors ? 'complete' : 'available'
		},
		{
			key: 'plan',
			href: `${base}/plan`,
			state: hasRecords && hasVendors ? (latestRun ? 'complete' : 'available') : 'locked'
		},
		{
			key: 'run',
			href: latestRun == null ? `${base}/run` : `${base}/runs/${latestRun.id}`,
			alsoMatches: workspace.runs.map((run) => `${base}/runs/${run.id}`),
			state:
				latestRun == null ? 'locked' : latestRun.status === 'completed' ? 'complete' : 'available'
		},
		{
			key: 'results',
			href: latestRun == null ? `${base}/results` : `${base}/runs/${latestRun.id}/results`,
			state: latestRun == null ? 'locked' : 'available',
			alsoMatches: workspace.runs.flatMap((run) => [
				`${base}/runs/${run.id}/results`,
				`${base}/runs/${run.id}/pairs`
			])
		}
	]
}

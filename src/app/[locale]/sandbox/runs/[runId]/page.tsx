import { RunScreen } from '@/components/pairsight/screens/run-screen'
import { loadRun, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxRunPage({ params }: { params: Promise<{ runId: string }> }) {
	const { runId } = await params
	return <RunScreen loaded={await loadRun(SANDBOX_TARGET, runId)} />
}

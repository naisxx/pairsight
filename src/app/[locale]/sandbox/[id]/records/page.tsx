import { RecordsScreen } from '@/components/pairsight/screens/records-screen'
import { loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'

export default async function SandboxRecordsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <RecordsScreen loaded={await loadWorkspace(sandboxTarget(id))} />
}

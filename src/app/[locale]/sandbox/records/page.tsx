import { RecordsScreen } from '@/components/pairsight/screens/records-screen'
import { loadWorkspace, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxRecordsPage() {
	return <RecordsScreen loaded={await loadWorkspace(SANDBOX_TARGET)} />
}

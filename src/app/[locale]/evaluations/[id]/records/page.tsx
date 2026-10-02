import { RecordsScreen } from '@/components/pairsight/screens/records-screen'
import { loadWorkspace } from '@/server/pairsight/evaluation-pages'

export default async function RecordsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const loaded = await loadWorkspace({ kind: 'owner', id, path: `/evaluations/${id}/records` })
	return <RecordsScreen loaded={loaded} />
}

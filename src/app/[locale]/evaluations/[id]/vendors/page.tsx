import { VendorsScreen } from '@/components/pairsight/screens/vendors-screen'
import { loadWorkspace } from '@/server/pairsight/evaluation-pages'

export default async function VendorsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const loaded = await loadWorkspace(
		{ kind: 'owner', id, path: `/evaluations/${id}/vendors` },
		'vendors'
	)
	return <VendorsScreen loaded={loaded} />
}

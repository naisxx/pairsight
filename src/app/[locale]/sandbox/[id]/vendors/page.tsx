import { VendorsScreen } from '@/components/pairsight/screens/vendors-screen'
import { loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'

export default async function SandboxVendorsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <VendorsScreen loaded={await loadWorkspace(sandboxTarget(id), 'vendors')} />
}

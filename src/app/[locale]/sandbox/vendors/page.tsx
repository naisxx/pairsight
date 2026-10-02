import { VendorsScreen } from '@/components/pairsight/screens/vendors-screen'
import { loadWorkspace, SANDBOX_TARGET } from '@/server/pairsight/evaluation-pages'

export default async function SandboxVendorsPage() {
	return <VendorsScreen loaded={await loadWorkspace(SANDBOX_TARGET, 'vendors')} />
}

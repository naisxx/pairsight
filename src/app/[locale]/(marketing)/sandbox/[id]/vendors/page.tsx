import { VendorsScreen } from '@/components/pairsight/screens/vendors-screen'
import { loadWorkspace, sandboxTarget } from '@/server/pairsight/evaluation-pages'
import { stepTitle } from '@/i18n/page-title'

export const generateMetadata = stepTitle('vendors')

export default async function SandboxVendorsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <VendorsScreen loaded={await loadWorkspace(sandboxTarget(id), 'vendors')} />
}

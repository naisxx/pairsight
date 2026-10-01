import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { StepHeader } from '@/components/pairsight/step-layout'
import { VendorsWorkspace } from '@/components/pairsight/vendors/vendors-workspace'
import { LIMITS } from '@/server/pairsight/limits'
import { listVendors } from '@/server/pairsight/vendor-exports'
import { loadWorkspace } from '../workspace'

export default async function VendorsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/vendors`, 'vendors'),
		getTranslations('Vendors')
	])
	const { dataset } = workspace
	// Unreachable: without records the stage is locked and loadWorkspace redirects.
	if (dataset == null) notFound()
	const vendors = await listVendors(id, dataset.id)
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			<VendorsWorkspace
				evaluationId={id}
				vendors={vendors}
				maxVendors={LIMITS.maxVendors}
				maxPairs={LIMITS.maxPairsPerRun}
			/>
		</>
	)
}

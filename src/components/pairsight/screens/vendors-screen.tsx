import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { StepHeader } from '@/components/pairsight/step-layout'
import { VendorsWorkspace } from '@/components/pairsight/vendors/vendors-workspace'
import { LIMITS } from '@/server/pairsight/limits'
import { listVendors } from '@/server/pairsight/vendor-exports'
import type { LoadedWorkspace } from '@/server/pairsight/evaluation-pages'

export async function VendorsScreen({ loaded }: { loaded: LoadedWorkspace }) {
	const { workspace, view } = loaded
	const id = view.evaluationId
	const t = await getTranslations('Vendors')
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
				maxPairs={LIMITS.maxVendorRows}
			/>
		</>
	)
}

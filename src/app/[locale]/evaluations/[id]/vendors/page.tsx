import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { NeedRecords } from '@/components/pairsight/empty/need-records'
import { RemoveVendorButton } from '@/components/pairsight/vendors/remove-vendor-button'
import { ActionBar, Section, StepHeader } from '@/components/pairsight/step-layout'
import { VendorForm } from '@/components/pairsight/vendors/vendor-form'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, FileIcon, VendorIcon } from '@/components/ui/icons'
import { LIMITS } from '@/server/pairsight/limits'
import { loadWorkspace } from '../workspace'

const VENDOR_LETTERS = ['A', 'B', 'C']

export default async function VendorsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/vendors`),
		getTranslations('Vendors')
	])
	const { dataset, vendorExports } = workspace
	const canAdd = vendorExports.length < LIMITS.maxVendors
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			{dataset == null ? (
				<NeedRecords evaluationId={id} />
			) : (
				<div className="flex flex-1 flex-col gap-6">
					{vendorExports.length > 0 && (
						<ul className="border-border bg-surface divide-border divide-y rounded-lg border">
							{vendorExports.map((vendorExport) => (
								<li key={vendorExport.id} className="flex items-center gap-3 px-4 py-3">
									<span className="text-text type-label">{vendorExport.name}</span>
									<span className="text-text-muted type-data-sm flex min-w-0 items-center gap-1 truncate">
										<FileIcon />
										{vendorExport.fileName}
									</span>
									<span className="text-text-muted type-body ml-auto">
										{t('added', { count: vendorExport.pairCount })}
									</span>
									<RemoveVendorButton exportId={vendorExport.id} name={vendorExport.name} />
								</li>
							))}
						</ul>
					)}
					{canAdd ? (
						<Section title={t('addTitle')} icon={VendorIcon}>
							<VendorForm
								evaluationId={id}
								defaultName={`Vendor ${VENDOR_LETTERS[vendorExports.length] ?? vendorExports.length + 1}`}
							/>
						</Section>
					) : (
						<p className="text-text-muted type-body">
							{t('maxVendors', { max: LIMITS.maxVendors })}
						</p>
					)}
					{vendorExports.length > 0 && (
						<ActionBar>
							<Button asChild>
								<Link href={`/evaluations/${id}/rules`}>
									{t('continue')}
									<ArrowRightIcon />
								</Link>
							</Button>
						</ActionBar>
					)}
				</div>
			)}
		</>
	)
}

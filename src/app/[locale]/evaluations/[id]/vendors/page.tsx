import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { RemoveVendorButton } from '@/components/pairsight/vendors/remove-vendor-button'
import { ActionBar, Section, StepHeader } from '@/components/pairsight/step-layout'
import { VendorForm } from '@/components/pairsight/vendors/vendor-form'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, FileIcon } from '@/components/ui/icons'
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
				<p className="text-text-muted text-sm">
					<Link
						href={`/evaluations/${id}/records`}
						className="text-accent-ink font-medium hover:underline"
					>
						{t('needRecords')}
					</Link>
				</p>
			) : (
				<div className="flex flex-col gap-6">
					{vendorExports.length > 0 && (
						<ul className="border-border bg-surface divide-border divide-y rounded-lg border">
							{vendorExports.map((vendorExport) => (
								<li key={vendorExport.id} className="flex items-center gap-3 px-4 py-3">
									<span className="text-text font-medium">{vendorExport.name}</span>
									<span className="text-text-muted flex min-w-0 items-center gap-1 truncate text-sm">
										<FileIcon />
										{vendorExport.fileName}
									</span>
									<span className="text-text-muted ml-auto text-sm tabular-nums">
										{t('added', { count: vendorExport.pairCount })}
									</span>
									<RemoveVendorButton exportId={vendorExport.id} name={vendorExport.name} />
								</li>
							))}
						</ul>
					)}
					{canAdd ? (
						<Section title={t('addTitle')}>
							<VendorForm
								evaluationId={id}
								defaultName={`Vendor ${VENDOR_LETTERS[vendorExports.length] ?? vendorExports.length + 1}`}
							/>
						</Section>
					) : (
						<p className="text-text-muted text-sm">{t('maxVendors', { max: LIMITS.maxVendors })}</p>
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

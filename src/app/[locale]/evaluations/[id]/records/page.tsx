import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { RecordsUploader } from '@/components/pairsight/records/records-uploader'
import { ReplaceSource } from '@/components/pairsight/records/replace-source'
import { ActionBar, StepHeader } from '@/components/pairsight/step-layout'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, FileIcon, SuccessIcon } from '@/components/ui/icons'
import { FIELD_ROLES } from '@/server/pairsight/fields'
import { loadWorkspace } from '../workspace'

export default async function RecordsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/records`),
		getTranslations('Records')
	])
	const { dataset } = workspace
	return (
		<>
			<StepHeader title={t('title')} description={t('description')} />
			{dataset == null ? (
				<RecordsUploader evaluationId={id} roles={FIELD_ROLES} />
			) : (
				<>
					<div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-4">
						<SuccessIcon size={20} className="text-success" />
						<FileIcon className="text-text-muted" />
						<p className="text-text type-label">
							{t('current', { fileName: dataset.fileName, count: dataset.rowCount })}
						</p>
					</div>
					<ReplaceSource evaluationId={id} roles={FIELD_ROLES} />
					<ActionBar>
						<Button asChild>
							<Link href={`/evaluations/${id}/vendors`}>
								{t('continue')}
								<ArrowRightIcon />
							</Link>
						</Button>
					</ActionBar>
				</>
			)}
		</>
	)
}

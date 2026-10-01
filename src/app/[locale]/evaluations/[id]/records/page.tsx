import { getTranslations } from 'next-intl/server'
import { RecordsUploader } from '@/components/pairsight/records/records-uploader'
import { SavedRecords } from '@/components/pairsight/records/saved-records'
import { StepHeader } from '@/components/pairsight/step-layout'
import { getDatasetPreview } from '@/server/pairsight/datasets'
import { FIELD_ROLES } from '@/server/pairsight/fields'
import { parseColumnRoles, parseRecordValues } from '@/server/pairsight/json'
import { loadWorkspace } from '../workspace'

const PREVIEW_ROWS = 10

export default async function RecordsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const [{ workspace }, t] = await Promise.all([
		loadWorkspace(id, `/evaluations/${id}/records`),
		getTranslations('Records')
	])
	const { dataset } = workspace
	const header = <StepHeader title={t('title')} description={t('description')} />
	if (dataset == null) {
		return (
			<>
				{header}
				<RecordsUploader evaluationId={id} roles={FIELD_ROLES} />
			</>
		)
	}

	const records = await getDatasetPreview(dataset.id, PREVIEW_ROWS)
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	// Stored values don't keep the file's column order, so: the reference,
	// then mapped fields in field order, then the rest.
	const others = Object.keys(columnRoles)
	const mapped = FIELD_ROLES.flatMap((role) =>
		others.filter((column) => columnRoles[column] === role && role !== 'other')
	)
	const headers = [
		dataset.referenceColumn,
		...mapped,
		...others.filter((column) => !mapped.includes(column))
	]
	return (
		<>
			{header}
			<SavedRecords
				evaluationId={id}
				roles={FIELD_ROLES}
				fileName={dataset.fileName}
				savedAt={dataset.createdAt}
				rowCount={dataset.rowCount}
				headers={headers}
				referenceColumn={dataset.referenceColumn}
				columnRoles={columnRoles}
				rows={records.map((record) => {
					const values = parseRecordValues(record.values)
					return {
						rowNumber: record.rowNumber,
						cells: headers.map((column) => values[column] ?? '')
					}
				})}
			/>
		</>
	)
}

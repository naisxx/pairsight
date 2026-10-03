import { getTranslations } from 'next-intl/server'
import { RecordsUploader } from '@/components/pairsight/records/records-uploader'
import { SavedRecords } from '@/components/pairsight/records/saved-records'
import { StepHeader } from '@/components/pairsight/step-layout'
import { getDatasetPreview } from '@/server/pairsight/datasets'
import { entityTypeOf, rolesFor } from '@/lib/pairsight/entity-types'
import { parseColumnRoles, parseRecordValues } from '@/server/pairsight/json'
import type { LoadedWorkspace } from '@/server/pairsight/evaluation-pages'

const PREVIEW_ROWS = 10

// Records: the uploader before a file is saved, the saved file read-only after.
export async function RecordsScreen({ loaded }: { loaded: LoadedWorkspace }) {
	const { workspace, view } = loaded
	const id = view.evaluationId
	const t = await getTranslations('Records')
	const { dataset } = workspace
	const header = <StepHeader title={t('title')} description={t('description')} />
	if (dataset == null) {
		return (
			<>
				{header}
				<RecordsUploader evaluationId={id} />
			</>
		)
	}

	const records = await getDatasetPreview(dataset.id, PREVIEW_ROWS)
	const roles = rolesFor(entityTypeOf(workspace.evaluation.entityType))
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	// Stored values don't keep the file's column order, so: the reference,
	// then mapped fields in field order, then the rest.
	const others = Object.keys(columnRoles)
	const mapped = roles.flatMap((role) => others.filter((column) => columnRoles[column] === role))
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
				roles={roles}
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

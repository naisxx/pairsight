'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ArrowRightIcon, RetryIcon } from '@/components/ui/icons'
import type { FieldRole } from '@/server/pairsight/fields'
import { useFileTypeLabel } from '../file-type'
import { ActionBar } from '../step-layout'
import { FieldMapping } from './field-mapping'
import { RecordsFileCard } from './records-file-card'
import { fieldFor, fieldKeys, savedMapping, type FieldKey } from './mapping'
import { RecordsPreview } from './records-preview'
import { RecordsUploader } from './records-uploader'
import { useEvaluationView } from '../evaluation-context'
import { ReadOnlyGate } from '../read-only'

const ICON_SIZE = 15
const SMALL_ICON_SIZE = 14

// The saved records file: what it holds and how its columns are mapped,
// read-only (a saved dataset is fixed). Replacing it asks first, then shows
// the uploader in its place, with a way back.
export function SavedRecords({
	evaluationId,
	roles,
	fileName,
	savedAt,
	rowCount,
	headers,
	referenceColumn,
	columnRoles,
	rows
}: {
	evaluationId: string
	roles: readonly FieldRole[]
	fileName: string
	savedAt: Date
	rowCount: number
	headers: string[]
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	rows: Array<{ rowNumber: number; cells: string[] }>
}) {
	const t = useTranslations('Records')
	const tRoles = useTranslations('Roles')
	const fileType = useFileTypeLabel()
	const view = useEvaluationView()
	const format = useFormatter()
	const [isConfirming, setIsConfirming] = useState(false)
	const [isReplacing, setIsReplacing] = useState(false)

	if (isReplacing) {
		return <RecordsUploader evaluationId={evaluationId} onCancel={() => setIsReplacing(false)} />
	}

	const mapping = savedMapping({ referenceColumn, columnRoles })
	const label = (key: FieldKey) => (key === 'reference' ? t('referenceField') : tRoles(key))
	const fields = fieldKeys(roles)
	return (
		<>
			<div className="space-y-4">
				<RecordsFileCard
					fileName={fileName}
					meta={`${t('savedOn', { date: format.dateTime(savedAt, { dateStyle: 'medium' }) })} · ${fileType(fileName)}`}
					rows={rowCount}
					columns={headers.length}
					action={
						<ReadOnlyGate action="upload">
							<Button variant="secondary" size="sm" onClick={() => setIsConfirming(true)}>
								<RetryIcon size={SMALL_ICON_SIZE} />
								{t('replace')}
							</Button>
						</ReadOnlyGate>
					}
					// Saved, every ID was there and unique: it couldn't be saved otherwise.
					idStatus={{ kind: 'good', count: rowCount }}
					matchedFields={fields.filter((key) => mapping.get(key) != null).map(label)}
					needsReview={false}
					problems={null}
					columnsPanel={
						<FieldMapping
							fields={fields}
							headers={headers}
							sampleRows={rows.map((row) => row.cells)}
							mapping={mapping}
							bare
						/>
					}
					previewPanel={
						<RecordsPreview
							headers={headers}
							rows={rows}
							fieldLabels={Object.fromEntries(
								headers.map((header) => {
									const field = fieldFor(mapping, header)
									return [header, field == null ? null : label(field)]
								})
							)}
							referenceColumn={referenceColumn}
							problemRows={new Set()}
							bare
						/>
					}
				/>
			</div>

			<ActionBar back={{ href: view.homeHref, label: t('back') }}>
				<Button asChild>
					<Link href={`${view.base}/vendors`}>
						{t('continue')}
						<ArrowRightIcon size={ICON_SIZE} />
					</Link>
				</Button>
			</ActionBar>

			<Dialog
				open={isConfirming}
				onOpenChange={setIsConfirming}
				title={t('replaceTitle')}
				description={t('replaceDescription')}
				closeLabel={t('close')}
				width="sm"
				footer={
					<>
						<Button variant="secondary" onClick={() => setIsConfirming(false)}>
							{t('keepFile')}
						</Button>
						<Button
							variant="danger"
							onClick={() => {
								setIsConfirming(false)
								setIsReplacing(true)
							}}
						>
							{t('replace')}
						</Button>
					</>
				}
			/>
		</>
	)
}

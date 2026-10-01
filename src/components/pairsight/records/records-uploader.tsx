'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { FileIcon, SpinnerIcon } from '@/components/ui/icons'
import type { CsvPreview } from '@/server/actions/pairsight/shared'
import {
	previewSourceCsv,
	saveSourceAction,
	type SaveSourceResult
} from '@/server/actions/pairsight/sources'
import type { FieldRole } from '@/server/pairsight/fields'
import { ColumnSelect } from '../column-select'
import { FileDrop } from '../file-drop'
import { readCsvFile, useCsvErrorMessage, useRowList, ValidationPanel } from '../validation'
import { ColumnMappingTable } from './column-mapping-table'

type Loaded = { fileName: string; text: string; preview: Extract<CsvPreview, { ok: true }> }
type SaveIssues = Exclude<Extract<SaveSourceResult, { ok: false }>, { parseError: unknown }>

const MAX_LISTED_DUPLICATES = 10

// Choose a CSV → preview and map columns → save (validated again on the
// server). `fieldRoles` comes from the server page so this client file never
// imports server modules at runtime.
export function RecordsUploader({
	evaluationId,
	roles: fieldRoles
}: {
	evaluationId: string
	roles: readonly FieldRole[]
}) {
	const t = useTranslations('Records')
	const tRoles = useTranslations('Roles')
	const router = useRouter()
	const csvError = useCsvErrorMessage()
	const list = useRowList()
	const [loaded, setLoaded] = useState<Loaded | null>(null)
	const [referenceColumn, setReferenceColumn] = useState('')
	const [roles, setRoles] = useState<Record<string, FieldRole>>({})
	const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set())
	const [errors, setErrors] = useState<string[]>([])
	const [isReading, startReading] = useTransition()
	const [isSaving, startSaving] = useTransition()

	const issueMessages = (issues: SaveIssues) => [
		...(issues.missingReferenceColumn ? [t('missingReferenceColumn')] : []),
		...(issues.referenceIssues.missing.length > 0
			? [
					t('missingReferences', {
						count: issues.referenceIssues.missing.length,
						rows: list(issues.referenceIssues.missing)
					})
				]
			: []),
		...issues.referenceIssues.duplicates
			.slice(0, MAX_LISTED_DUPLICATES)
			.map((duplicate) =>
				t('duplicateReference', { reference: duplicate.reference, rows: list(duplicate.rows) })
			),
		...(issues.duplicateRoles.length > 0
			? [
					t('duplicateRoles', {
						roles: issues.duplicateRoles.map((role) => tRoles(role)).join(', ')
					})
				]
			: [])
	]

	function onFile(file: File) {
		setErrors([])
		startReading(async () => {
			const read = await readCsvFile(file)
			if (!read.ok) return setErrors([csvError({ code: read.code })])
			const result = await previewSourceCsv({ text: read.text })
			if (!result.ok) return setErrors([result.error])
			if (!result.data.ok) return setErrors([csvError(result.data.error)])
			const preview = result.data
			setLoaded({ fileName: file.name, text: read.text, preview })
			setReferenceColumn(preview.suggestedReference ?? preview.headers[0] ?? '')
			setRoles(preview.suggestedRoles)
			setConfirmed(new Set())
		})
	}

	function save() {
		if (loaded == null) return
		setErrors([])
		startSaving(async () => {
			const result = await saveSourceAction({
				evaluationId,
				fileName: loaded.fileName,
				text: loaded.text,
				referenceColumn,
				columnRoles: roles
			})
			if (!result.ok) return setErrors([result.error])
			const data = result.data
			if (data.ok) {
				setLoaded(null)
				router.refresh()
			} else if ('parseError' in data) setErrors([csvError(data.parseError)])
			else setErrors(issueMessages(data))
		})
	}

	if (loaded == null) {
		return (
			<div className="flex flex-col gap-4">
				<FileDrop
					label={t('dropLabel')}
					hint={t('dropHint')}
					busyLabel={t('reading')}
					isBusy={isReading}
					onFile={onFile}
				/>
				<ValidationPanel title={t('errorsTitle')} messages={errors} />
			</div>
		)
	}

	const { preview } = loaded
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 className="text-text type-heading">{t('previewTitle')}</h2>
					<p className="text-text-muted type-body mt-1 max-w-2xl">{t('previewDescription')}</p>
				</div>
				<p className="text-text-muted type-body flex items-center gap-1.5">
					<FileIcon />
					{loaded.fileName}
				</p>
			</div>
			<ColumnSelect
				label={t('referenceColumn')}
				value={referenceColumn}
				headers={preview.headers}
				onChange={setReferenceColumn}
				className="max-w-sm"
			/>
			<ValidationPanel title={t('errorsTitle')} messages={errors} />
			<ColumnMappingTable
				headers={preview.headers}
				sampleRows={preview.sampleRows}
				referenceColumn={referenceColumn}
				roles={roles}
				confirmed={confirmed}
				fieldRoles={fieldRoles}
				onRoleChange={(header, role) => {
					setRoles((current) => ({ ...current, [header]: role }))
					setConfirmed((current) => new Set(current).add(header))
				}}
			/>
			<p className="text-text-muted type-meta">
				{t('showingRows', { shown: preview.sampleRows.length, total: preview.rowCount })}
			</p>
			<div className="flex justify-end gap-3">
				<Button variant="outline" onClick={() => setLoaded(null)} disabled={isSaving}>
					{t('replace')}
				</Button>
				<Button onClick={save} disabled={isSaving || referenceColumn === ''}>
					{isSaving && <SpinnerIcon />}
					{isSaving ? t('saving') : t('save')}
				</Button>
			</div>
		</div>
	)
}

'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, InfoIcon, RetryIcon, SpinnerIcon } from '@/components/ui/icons'
import {
	previewSourceFile,
	saveSourceAction,
	type SaveSourceResult,
	type SourcePreview
} from '@/server/actions/pairsight/sources'
import { DEFAULT_ENTITY_TYPE, rolesFor, type EntityType } from '@/lib/pairsight/entity-types'
import { FileDrop } from '../file-drop'
import { uploadFile } from '../upload-file'
import { useFileTypeLabel } from '../file-type'
import { SheetPicker, type SheetChoice } from '../sheet-picker'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { checkTabularFile, useFileErrorMessage, useRowList, ValidationPanel } from '../validation'
import { EntityTypePicker } from './entity-type-picker'
import { FieldMapping } from './field-mapping'
import { RecordsFileCard } from './records-file-card'
import {
	assignColumn,
	fieldFor,
	fieldKeys,
	suggestedMapping,
	toColumnRoles,
	type FieldKey,
	type Mapping
} from './mapping'
import { RecordsPreview } from './records-preview'
import { SourceValidation } from './source-validation'
import { useEvaluationView } from '../evaluation-context'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/custom-rules'

// The chosen file is uploaded once (upload-file.ts); the preview and the
// save name it by id, with the sheet it was read from (preview.sheet).
type Loaded = {
	file: File
	uploadId: string
	preview: Extract<SourcePreview, { ok: true }>
}
// A workbook with several sheets of data, waiting for the user to pick one.
type Choosing = { file: File; uploadId: string; sheets: SheetChoice[]; picked: string | null }
type SaveIssues = Exclude<Extract<SaveSourceResult, { ok: false }>, { parseError: unknown }>

const MAX_LISTED_DUPLICATES = 10
const BYTES_PER_KB = 1024
const MIN_SHOWN_KB = 0.1
const ICON_SIZE = 15
const HINT_ICON_SIZE = 15
const SMALL_ICON_SIZE = 14
// Data rows start on line 2 of the file, under the header.
const FIRST_DATA_ROW = 2

function formatSize(bytes: number) {
	const kb = bytes / BYTES_PER_KB
	return kb > BYTES_PER_KB
		? `${(kb / BYTES_PER_KB).toFixed(1)} MB`
		: `${Math.max(MIN_SHOWN_KB, kb).toFixed(1)} KB`
}

// Choose a file (CSV, or an Excel sheet) → confirm what its records are
// (detected from the file) → map its columns, checked as you go → save and
// continue to vendors (validated again on the server). `onCancel`, when
// replacing a saved file, goes back to it.
export function RecordsUploader({
	evaluationId,
	onCancel
}: {
	evaluationId: string
	onCancel?: () => void
}) {
	const t = useTranslations('Records')
	const tRoles = useTranslations('Roles')
	const view = useEvaluationView()
	const router = useRouter()
	const fileError = useFileErrorMessage()
	const fileType = useFileTypeLabel()
	const list = useRowList()
	const [loaded, setLoaded] = useState<Loaded | null>(null)
	const [choosing, setChoosing] = useState<Choosing | null>(null)
	// While the file goes up: how much of it has.
	const [uploadPercent, setUploadPercent] = useState<number | null>(null)
	const [mapping, setMapping] = useState<Mapping>(new Map())
	const [suggested, setSuggested] = useState<Mapping>(new Map())
	const [entityType, setEntityType] = useState<EntityType>(DEFAULT_ENTITY_TYPE)
	const [errors, setErrors] = useState<string[]>([])
	const [isReading, startReading] = useTransition()
	const [isSaving, startSaving] = useTransition()
	const fields = fieldKeys(rolesFor(entityType))
	const label = (key: FieldKey) => (key === 'reference' ? t('referenceField') : tRoles(key))

	const issueMessages = (issues: SaveIssues) => [
		...(issues.missingReferenceColumn ? [t('missingReferenceColumn')] : []),
		...(issues.referenceCheck.blank > 0
			? [
					t('missingReferences', {
						count: issues.referenceCheck.blank,
						rows: list(issues.referenceCheck.missing, issues.referenceCheck.blank)
					})
				]
			: []),
		...issues.referenceCheck.duplicates.slice(0, MAX_LISTED_DUPLICATES).map((duplicate) =>
			t('duplicateReference', {
				reference: duplicate.reference,
				rows: list(duplicate.rows, duplicate.count)
			})
		),
		...(issues.duplicateRoles.length > 0
			? [
					t('duplicateRoles', {
						roles: issues.duplicateRoles.map((role) => tRoles(role)).join(', ')
					})
				]
			: [])
	]

	function read(file: File, uploadId: string, sheet?: string) {
		setErrors([])
		startReading(async () => {
			const result = await previewSourceFile({ uploadId, sheet })
			if (!result.ok) return setErrors([result.error])
			const data = result.data
			if (!data.ok) {
				if (data.error.code !== 'choose_sheet') return setErrors([fileError(data.error)])
				return setChoosing({ file, uploadId, sheets: data.error.sheets, picked: null })
			}
			const type = data.detection.type
			const suggestion = suggestedMapping({
				headers: data.headers,
				suggestedReference: data.suggestedReference,
				suggestedRoles: data.suggestedRoles[type]
			})
			setChoosing(null)
			setLoaded({ file, uploadId, preview: data })
			setEntityType(type)
			setSuggested(suggestion)
			setMapping(suggestion)
		})
	}

	// Another type: its own fields, suggested afresh; the reference stays.
	function changeType(type: EntityType) {
		if (loaded == null) return
		const { preview } = loaded
		const suggestion = suggestedMapping({
			headers: preview.headers,
			suggestedReference: mapping.get('reference') ?? preview.suggestedReference,
			suggestedRoles: preview.suggestedRoles[type]
		})
		setEntityType(type)
		setSuggested(suggestion)
		setMapping(suggestion)
	}

	function onFile(file: File) {
		setChoosing(null)
		setErrors([])
		const checked = checkTabularFile(file)
		if (!checked.ok) return setErrors([fileError({ code: checked.code })])
		startReading(async () => {
			setUploadPercent(0)
			const uploaded = await uploadFile({
				evaluationId,
				kind: 'records',
				file,
				onProgress: setUploadPercent
			})
			setUploadPercent(null)
			if (!uploaded.ok) {
				return setErrors([
					uploaded.tooLarge
						? fileError({ code: 'too_large' })
						: (uploaded.message ?? t('uploadFailed'))
				])
			}
			read(file, uploaded.uploadId)
		})
	}

	// Another sheet of the same upload: nothing is sent again.
	function pickSheet(sheet: string) {
		if (choosing == null) return
		setChoosing({ ...choosing, picked: sheet })
		read(choosing.file, choosing.uploadId, sheet)
	}

	const reference = mapping.get('reference') ?? null
	const check =
		loaded == null || reference == null ? undefined : loaded.preview.columnChecks[reference]
	const problemCount = check == null ? 0 : check.blank + check.duplicateCount
	// The mapping opens by itself when something needs you: no ID column, ID
	// problems, or too few values for Jev to compare records by.
	const valuesMapped = [...mapping.keys()].filter((key) => key !== 'reference').length
	const needsReview = reference == null || problemCount > 0 || valuesMapped < MIN_JEV_FIELDS
	const blockedReason =
		loaded == null
			? isReading
				? t('blockedReading')
				: t('blockedUpload')
			: reference == null
				? t('blockedReference')
				: problemCount > 0
					? t('blockedProblems', { count: problemCount })
					: null

	function save() {
		if (loaded == null || reference == null) return
		setErrors([])
		startSaving(async () => {
			const result = await saveSourceAction({
				evaluationId,
				uploadId: loaded.uploadId,
				sheet: loaded.preview.sheet,
				referenceColumn: reference,
				entityType,
				columnRoles: toColumnRoles(mapping, loaded.preview.headers)
			})
			if (!result.ok) return setErrors([result.error])
			const data = result.data
			if (data.ok) router.push(`${view.base}/vendors`)
			else if ('parseError' in data) setErrors([fileError(data.parseError)])
			else setErrors(issueMessages(data))
		})
	}

	const actionBar = (
		<ActionBar
			back={{ href: view.homeHref, label: t('back') }}
			hint={
				blockedReason == null ? undefined : (
					<>
						<InfoIcon size={HINT_ICON_SIZE} className="shrink-0" />
						<span>{blockedReason}</span>
					</>
				)
			}
		>
			{onCancel != null && (
				<Button variant="secondary" onClick={onCancel} disabled={isSaving}>
					{t('keepFile')}
				</Button>
			)}
			<Button
				onClick={save}
				disabled={blockedReason != null || isSaving}
				aria-describedby={blockedReason == null ? undefined : ACTION_HINT_ID}
			>
				{isSaving ? t('saving') : t('continue')}
				{isSaving ? <SpinnerIcon size={ICON_SIZE} /> : <ArrowRightIcon size={ICON_SIZE} />}
			</Button>
		</ActionBar>
	)

	if (loaded == null) {
		return (
			<>
				<div className="max-w-3xl space-y-4">
					<FileDrop
						label={t('dropTitle')}
						hint={t('dropHint')}
						busyLabel={
							uploadPercent == null ? t('reading') : t('uploading', { percent: uploadPercent })
						}
						isBusy={isReading && choosing == null}
						onFile={onFile}
					/>
					{choosing != null && (
						<SheetPicker
							fileName={choosing.file.name}
							sheets={choosing.sheets}
							picked={choosing.picked}
							isBusy={isReading}
							onPick={pickSheet}
						/>
					)}
					<ValidationPanel title={t('errorsTitle')} messages={errors} />
				</div>
				{actionBar}
			</>
		)
	}

	const { preview } = loaded
	const problemRows = new Set([
		...(check?.missing ?? []),
		...(check?.duplicates.flatMap((duplicate) => duplicate.rows) ?? [])
	])
	const blanks = fields.flatMap((key) => {
		const column = mapping.get(key)
		const blank =
			key === 'reference' || column == null ? 0 : (preview.columnChecks[column]?.blank ?? 0)
		return blank > 0 ? [{ field: label(key), count: blank }] : []
	})

	return (
		<>
			<div className="space-y-4">
				<ValidationPanel title={t('errorsTitle')} messages={errors} />
				<RecordsFileCard
					fileName={loaded.file.name}
					meta={`${t('notSaved')} · ${fileType(loaded.file.name, preview.sheet)} · ${formatSize(loaded.file.size)}`}
					rows={preview.rowCount}
					columns={preview.headers.length}
					action={
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setLoaded(null)}
							disabled={isSaving}
						>
							<RetryIcon size={SMALL_ICON_SIZE} />
							{t('replace')}
						</Button>
					}
					idStatus={
						check == null
							? { kind: 'missing' }
							: problemCount > 0
								? { kind: 'problems', count: problemCount }
								: { kind: 'good', count: preview.rowCount }
					}
					matchedFields={fields.filter((key) => mapping.get(key) != null).map(label)}
					needsReview={needsReview}
					problems={
						check == null || problemCount > 0 ? (
							<SourceValidation check={check} rowCount={preview.rowCount} blanks={[]} bare />
						) : null
					}
					columnsPanel={
						<>
							<FieldMapping
								fields={fields}
								headers={preview.headers}
								sampleRows={preview.sampleRows}
								mapping={mapping}
								bare
								edit={{
									suggested,
									onChange: (key, column) =>
										setMapping((current) => assignColumn(current, key, column)),
									onUseAll: () => setMapping(suggested)
								}}
							/>
							{check != null && problemCount === 0 && (
								<SourceValidation check={check} rowCount={preview.rowCount} blanks={blanks} bare />
							)}
						</>
					}
					previewPanel={
						<RecordsPreview
							headers={preview.headers}
							rows={preview.sampleRows.map((cells, index) => ({
								rowNumber: index + FIRST_DATA_ROW,
								cells
							}))}
							fieldLabels={Object.fromEntries(
								preview.headers.map((header) => {
									const field = fieldFor(mapping, header)
									return [header, field == null ? null : label(field)]
								})
							)}
							referenceColumn={reference}
							problemRows={problemRows}
							bare
						/>
					}
				/>
				<EntityTypePicker
					value={entityType}
					detected={preview.detection.type}
					confident={preview.detection.confident}
					onChange={changeType}
					disabled={isSaving}
				/>
			</div>
			{actionBar}
		</>
	)
}

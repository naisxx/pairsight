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
import type { FieldRole } from '@/server/pairsight/fields'
import { FileDrop } from '../file-drop'
import { useFileTypeLabel } from '../file-type'
import { SheetPicker, type SheetChoice } from '../sheet-picker'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { checkTabularFile, useFileErrorMessage, useRowList, ValidationPanel } from '../validation'
import { FieldMapping } from './field-mapping'
import { FileDetails } from './file-details'
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

// The chosen file is kept as is and sent again on save, with the sheet it was
// read from (preview.sheet); the server reads it.
type Loaded = {
	file: File
	preview: Extract<SourcePreview, { ok: true }>
}
// A workbook with several sheets of data, waiting for the user to pick one.
type Choosing = { file: File; sheets: SheetChoice[]; picked: string | null }
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

// Choose a file (CSV, or an Excel sheet) → map its columns, checked as you go → save and continue to
// vendors (validated again on the server). `roles` comes from the server page
// so this client file never imports server modules at runtime. `onCancel`,
// when replacing a saved file, goes back to it.
export function RecordsUploader({
	evaluationId,
	roles,
	onCancel
}: {
	evaluationId: string
	roles: readonly FieldRole[]
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
	const [mapping, setMapping] = useState<Mapping>(new Map())
	const [suggested, setSuggested] = useState<Mapping>(new Map())
	const [errors, setErrors] = useState<string[]>([])
	const [isReading, startReading] = useTransition()
	const [isSaving, startSaving] = useTransition()
	const fields = fieldKeys(roles)
	const label = (key: FieldKey) => (key === 'reference' ? t('referenceField') : tRoles(key))

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

	function read(file: File, sheet?: string) {
		setErrors([])
		startReading(async () => {
			const result = await previewSourceFile({ file, sheet })
			if (!result.ok) return setErrors([result.error])
			const data = result.data
			if (!data.ok) {
				if (data.error.code !== 'choose_sheet') return setErrors([fileError(data.error)])
				return setChoosing({ file, sheets: data.error.sheets, picked: null })
			}
			const suggestion = suggestedMapping(data)
			setChoosing(null)
			setLoaded({ file, preview: data })
			setSuggested(suggestion)
			setMapping(suggestion)
		})
	}

	function onFile(file: File) {
		setChoosing(null)
		const checked = checkTabularFile(file)
		if (!checked.ok) return setErrors([fileError({ code: checked.code })])
		read(file)
	}

	function pickSheet(sheet: string) {
		if (choosing == null) return
		setChoosing({ ...choosing, picked: sheet })
		read(choosing.file, sheet)
	}

	const reference = mapping.get('reference') ?? null
	const check =
		loaded == null || reference == null ? undefined : loaded.preview.columnChecks[reference]
	const problemCount = check == null ? 0 : check.blank + check.duplicateCount
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
				file: loaded.file,
				sheet: loaded.preview.sheet,
				referenceColumn: reference,
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
						busyLabel={t('reading')}
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
				<FileDetails
					fileName={loaded.file.name}
					meta={`${t('notSaved')} · ${fileType(loaded.file.name, preview.sheet)}`}
					rows={preview.rowCount}
					columns={preview.headers.length}
					size={formatSize(loaded.file.size)}
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
				/>
				<ValidationPanel title={t('errorsTitle')} messages={errors} />
				<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
					<div className="@5xl:col-span-8">
						<FieldMapping
							fields={fields}
							headers={preview.headers}
							sampleRows={preview.sampleRows}
							mapping={mapping}
							edit={{
								suggested,
								onChange: (key, column) =>
									setMapping((current) => assignColumn(current, key, column)),
								onUseAll: () => setMapping(suggested)
							}}
						/>
					</div>
					{/* In one column, the checks come first: they say why Continue is blocked. */}
					<div className="order-first @5xl:order-none @5xl:col-span-4">
						<SourceValidation check={check} rowCount={preview.rowCount} blanks={blanks} />
					</div>
				</div>
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
				/>
			</div>
			{actionBar}
		</>
	)
}

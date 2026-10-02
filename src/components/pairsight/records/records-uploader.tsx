'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, InfoIcon, RetryIcon, SpinnerIcon } from '@/components/ui/icons'
import {
	previewSourceCsv,
	saveSourceAction,
	type SaveSourceResult,
	type SourcePreview
} from '@/server/actions/pairsight/sources'
import type { FieldRole } from '@/server/pairsight/fields'
import { FileDrop } from '../file-drop'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { readCsvFile, useCsvErrorMessage, useRowList, ValidationPanel } from '../validation'
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

type Loaded = {
	fileName: string
	bytes: number
	text: string
	preview: Extract<SourcePreview, { ok: true }>
}
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

// Choose a CSV → map its columns, checked as you go → save and continue to
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
	const csvError = useCsvErrorMessage()
	const list = useRowList()
	const [loaded, setLoaded] = useState<Loaded | null>(null)
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

	function onFile(file: File) {
		setErrors([])
		startReading(async () => {
			const read = await readCsvFile(file)
			if (!read.ok) return setErrors([csvError({ code: read.code })])
			const result = await previewSourceCsv({ text: read.text })
			if (!result.ok) return setErrors([result.error])
			if (!result.data.ok) return setErrors([csvError(result.data.error)])
			const preview = result.data
			const suggestion = suggestedMapping(preview)
			setLoaded({ fileName: file.name, bytes: file.size, text: read.text, preview })
			setSuggested(suggestion)
			setMapping(suggestion)
		})
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
				fileName: loaded.fileName,
				text: loaded.text,
				referenceColumn: reference,
				columnRoles: toColumnRoles(mapping, loaded.preview.headers)
			})
			if (!result.ok) return setErrors([result.error])
			const data = result.data
			if (data.ok) router.push(`${view.base}/vendors`)
			else if ('parseError' in data) setErrors([csvError(data.parseError)])
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
						isBusy={isReading}
						onFile={onFile}
					/>
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
					fileName={loaded.fileName}
					meta={t('notSaved')}
					rows={preview.rowCount}
					columns={preview.headers.length}
					size={formatSize(loaded.bytes)}
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

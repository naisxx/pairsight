'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { FileIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import {
	previewVendorCsv,
	saveVendorAction,
	type SaveVendorResult
} from '@/server/actions/pairsight/vendors'
import { ColumnSelect } from '../column-select'
import { FileDrop } from '../file-drop'
import { readCsvFile, useCsvErrorMessage, useRowList, ValidationPanel } from '../validation'
import { CompletenessConfirm } from './completeness-confirm'

type Loaded = { fileName: string; text: string; headers: string[] }
type ReferenceIssues = Extract<SaveVendorResult, { issues: unknown }>['issues']

// Pair-column guesses: headers that look like "record 1 / record 2", else the
// first two columns. The user always confirms them.
function suggestColumns(headers: string[]): [string, string] {
	const refLike = headers.filter((header) => /ref|id|record/i.test(header))
	const picks = refLike.length >= 2 ? refLike : headers
	return [picks[0] ?? '', picks[1] ?? '']
}

// Add one vendor's pair export: name, file, the two reference columns, and
// the completeness confirmation. Unknown references come back with row numbers.
export function VendorForm({
	evaluationId,
	defaultName
}: {
	evaluationId: string
	defaultName: string
}) {
	const t = useTranslations('Vendors')
	const router = useRouter()
	const id = useId()
	const csvError = useCsvErrorMessage()
	const list = useRowList()
	const [name, setName] = useState(defaultName)
	const [loaded, setLoaded] = useState<Loaded | null>(null)
	const [columnA, setColumnA] = useState('')
	const [columnB, setColumnB] = useState('')
	const [isComplete, setIsComplete] = useState(false)
	const [errors, setErrors] = useState<string[]>([])
	const [savedMessage, setSavedMessage] = useState<string | null>(null)
	const [isReading, startReading] = useTransition()
	const [isSaving, startSaving] = useTransition()

	const issueMessages = ({ unknownReferences, missingReferenceRows }: ReferenceIssues) => [
		...(unknownReferences.length > 0
			? [
					`${t('unknownReferences', { count: unknownReferences.length })}: ${list(
						unknownReferences.map((item) =>
							t('unknownRow', { row: item.row, reference: item.reference })
						)
					)}`
				]
			: []),
		...(missingReferenceRows.length > 0
			? [
					t('missingReferenceRows', {
						count: missingReferenceRows.length,
						rows: list(missingReferenceRows)
					})
				]
			: [])
	]

	function onFile(file: File) {
		setErrors([])
		setSavedMessage(null)
		startReading(async () => {
			const read = await readCsvFile(file)
			if (!read.ok) return setErrors([csvError({ code: read.code })])
			const result = await previewVendorCsv({ text: read.text })
			if (!result.ok) return setErrors([result.error])
			if (!result.data.ok) return setErrors([csvError(result.data.error)])
			const [first, second] = suggestColumns(result.data.headers)
			setLoaded({ fileName: file.name, text: read.text, headers: result.data.headers })
			setColumnA(first)
			setColumnB(second)
		})
	}

	function save() {
		if (loaded == null || !isComplete) return
		if (columnA === columnB) return setErrors([t('sameColumns')])
		setErrors([])
		startSaving(async () => {
			const result = await saveVendorAction({
				evaluationId,
				name,
				fileName: loaded.fileName,
				text: loaded.text,
				columnA,
				columnB,
				confirmedComplete: true
			})
			if (!result.ok) return setErrors([result.error])
			const data = result.data
			if (data.ok) {
				const skipped = t('skipped', {
					self: data.selfPairRows,
					duplicates: data.duplicateRows
				}).trim()
				setSavedMessage(t('savedSummary', { pairs: data.pairCount, skipped }))
				setLoaded(null)
				setIsComplete(false)
				router.refresh()
			} else if ('parseError' in data) setErrors([csvError(data.parseError)])
			else setErrors(issueMessages(data.issues))
		})
	}

	return (
		<div className="flex flex-col gap-4">
			{savedMessage != null && (
				<p
					role="status"
					className="bg-success-subtle text-success type-body flex items-center gap-2 rounded px-3 py-2"
				>
					<SuccessIcon />
					{savedMessage}
				</p>
			)}
			<div className="flex max-w-sm flex-col gap-1.5">
				<Label htmlFor={`${id}-name`}>{t('nameLabel')}</Label>
				<Input
					id={`${id}-name`}
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder={t('namePlaceholder')}
					maxLength={NAME_MAX_LENGTH}
				/>
			</div>
			{loaded == null ? (
				<FileDrop
					label={t('dropLabel')}
					hint={t('dropHint')}
					busyLabel={t('saving')}
					isBusy={isReading}
					onFile={onFile}
				/>
			) : (
				<div className="flex flex-col gap-4">
					<p className="text-text-muted type-data-sm flex items-center gap-1.5">
						<FileIcon />
						{loaded.fileName}
						<Button variant="ghost" size="sm" onClick={() => setLoaded(null)}>
							{t('fileLabel')}…
						</Button>
					</p>
					<div className="grid max-w-xl gap-3 sm:grid-cols-2">
						<ColumnSelect
							label={t('columnA')}
							value={columnA}
							headers={loaded.headers}
							onChange={setColumnA}
						/>
						<ColumnSelect
							label={t('columnB')}
							value={columnB}
							headers={loaded.headers}
							onChange={setColumnB}
						/>
					</div>
					<CompletenessConfirm isConfirmed={isComplete} onChange={setIsComplete} />
				</div>
			)}
			<ValidationPanel title={t('errorsTitle')} messages={errors} />
			{loaded != null && (
				<div className="flex justify-end">
					<Button onClick={save} disabled={isSaving || !isComplete || name.trim() === ''}>
						{isSaving && <SpinnerIcon />}
						{isSaving ? t('saving') : t('save')}
					</Button>
				</div>
			)}
		</div>
	)
}

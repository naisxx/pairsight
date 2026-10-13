'use client'

import { LIMITS } from '@/server/pairsight/limits'
import { BYTES_PER_MB } from '@/lib/pairsight/tabular-formats'
import { useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SpinnerIcon } from '@/components/ui/icons'
import { OptionSelect } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import {
	checkVendorFileAction,
	confirmVendorAction,
	type VendorFileCheck
} from '@/server/actions/pairsight/vendors'
import type { VendorListItem } from '@/server/pairsight/vendor-exports'
import type { VendorColumns, VendorFormat } from '@/server/pairsight/vendors'
import { SAMPLE_FILES, SampleLink } from '../sample-link'
import { FileDrop } from '../file-drop'
import { useEvaluationView } from '../evaluation-context'
import { uploadFile } from '../upload-file'
import { TabularFileIcon, useFileTypeLabel } from '../file-type'
import { SheetPicker, type SheetChoice } from '../sheet-picker'
import { checkTabularFile, useFileErrorMessage, useRowList, ValidationPanel } from '../validation'
import { FormatExample } from './format-example'
import { Glyph } from '../glyph'
import { VendorSwatch } from '../vendor-swatch'

type Checked = Extract<VendorFileCheck, { ok: true }>
type Pending = { format: VendorFormat; first: string; second: string }

const FILE_ICON_SIZE = 22
const FORMATS: VendorFormat[] = ['pair', 'group']

function toPending(columns: VendorColumns | null): Pending {
	if (columns == null) return { format: 'pair', first: '', second: '' }
	return columns.format === 'pair'
		? { format: 'pair', first: columns.columnA, second: columns.columnB }
		: { format: 'group', first: columns.groupColumn, second: columns.referenceColumn }
}

function fromPending({ format, first, second }: Pending): VendorColumns | null {
	if (first === '' || second === '' || first === second) return null
	return format === 'pair'
		? { format, columnA: first, columnB: second }
		: { format, groupColumn: first, referenceColumn: second }
}

// A vendor's card (pairsight-handoff Vendors): its name and how many pairs it
// matched, then its file. Drop it in, and PairSight works out the format and
// columns from your records' references and checks every row; how it was read
// and what the checks found are shown under it. "Change" (or a file it can't
// read on its own) opens the format and column pickers. A file that passes is
// kept on the draft; confirming it complete makes the vendor ready.
export function VendorFile({
	vendor,
	index,
	maxPairs,
	name,
	status,
	remove,
	suggestedOverlap
}: {
	vendor: VendorListItem
	// Its place in the list: which colour it takes (vendor-swatch.tsx).
	index: number
	maxPairs: number
	// The vendor's name field, as the card's heading.
	name: React.ReactNode
	// Ready, or what it still needs.
	status: string
	// Its Remove button, at the foot of the card.
	remove?: React.ReactNode
	// Ready: how many of its pairs PairSight suggests anyway.
	suggestedOverlap?: { found: number; total: number }
}) {
	const t = useTranslations('Vendors')
	const format = useFormatter()
	const router = useRouter()
	const fileError = useFileErrorMessage()
	const fileType = useFileTypeLabel()
	const list = useRowList()
	const view = useEvaluationView()
	// The chosen file, uploaded once (upload-file.ts) and re-checked from
	// there when its columns or sheet change, with the workbook sheet it's
	// read from (`sheet`) once one is picked.
	const [file, setFile] = useState<{ file: File; uploadId: string } | null>(null)
	// While the file goes up: how much of it has.
	const [uploadPercent, setUploadPercent] = useState<number | null>(null)
	const [sheet, setSheet] = useState<string | undefined>(undefined)
	const [sheets, setSheets] = useState<SheetChoice[] | null>(null)
	const [checked, setChecked] = useState<Checked | null>(null)
	const [errors, setErrors] = useState<string[]>([])
	const [isReplacing, setIsReplacing] = useState(false)
	const [isChoosing, setIsChoosing] = useState(false)
	const [pending, setPending] = useState<Pending>(toPending(vendor.columns))
	const [isChecking, startChecking] = useTransition()
	const [isConfirming, startConfirming] = useTransition()
	const isDraft = vendor.kind === 'draft'

	function check(
		uploadId: string,
		{ columns, sheet }: { columns?: VendorColumns; sheet?: string } = {}
	) {
		setErrors([])
		startChecking(async () => {
			const result = await checkVendorFileAction({
				draftId: vendor.id,
				uploadId,
				sheet,
				columns
			})
			if (!result.ok) return setErrors([result.error])
			if (!result.data.ok) {
				const error = result.data.parseError
				setChecked(null)
				if (error.code === 'choose_sheet') setSheets(error.sheets)
				else setErrors([fileError(error)])
				router.refresh()
				return
			}
			const data = result.data
			setSheets(null)
			setChecked(data)
			setPending(toPending(data.columns ?? data.detection?.guess ?? null))
			// Detection decides whether the pickers open; columns the user chose
			// keep them as they are.
			if (columns == null) setIsChoosing(data.columns == null)
			setIsReplacing(false)
			router.refresh()
		})
	}

	function onFile(chosen: File) {
		setErrors([])
		const checkedFile = checkTabularFile(chosen)
		if (!checkedFile.ok) return setErrors([fileError({ code: checkedFile.code })])
		startChecking(async () => {
			setUploadPercent(0)
			const uploaded = await uploadFile({
				evaluationId: view.evaluationId,
				kind: 'vendor',
				file: chosen,
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
			setFile({ file: chosen, uploadId: uploaded.uploadId })
			setSheet(undefined)
			setSheets(null)
			check(uploaded.uploadId)
		})
	}

	// Another sheet or other columns of the same upload: nothing is sent again.
	function pickSheet(name: string) {
		if (file == null) return
		setSheet(name)
		check(file.uploadId, { sheet: name })
	}

	function choose(next: Pending) {
		setPending(next)
		const columns = fromPending(next)
		if (file != null && columns != null) check(file.uploadId, { columns, sheet })
	}

	const showDrop = isDraft && (isReplacing || (file == null && vendor.fileName == null))
	const columns = checked?.columns ?? (file == null ? vendor.columns : null)
	const stats = checked?.stats ?? (file == null ? vendor.stats : null)
	const issues = checked?.issues ?? null
	const hasPassingFile =
		isDraft && vendor.fileName != null && issues == null && checked?.detection == null
	const fileName = file?.file.name ?? vendor.fileName
	const issueMessages =
		issues == null
			? []
			: [
					...(issues.unknownCount > 0
						? [
								`${t('unknownReferences', { count: issues.unknownCount })}: ${list(
									issues.unknownReferences.map((item) =>
										t('unknownRow', { row: item.row, reference: item.reference })
									)
								)}`
							]
						: []),
					...(issues.missingCount > 0
						? [
								t('missingReferenceRows', {
									count: issues.missingCount,
									rows: list(issues.missingReferenceRows)
								})
							]
						: []),
					...(issues.tooManyPairs ? [t('tooManyPairs', { max: maxPairs })] : [])
				]
	const col = (chunks: React.ReactNode) => <span className="text-text">{chunks}</span>
	const unknownCount = issues?.unknownCount ?? 0

	return (
		<article
			aria-label={vendor.name === '' ? t('untitled') : vendor.name}
			className="border-border bg-surface flex min-w-0 flex-col rounded-lg border p-6 md:p-7"
		>
			<header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<VendorSwatch index={index} className="size-3" />
					{name}
				</div>
				{stats != null && (
					<span className="text-text-muted text-sm">
						{t.rich('pairsMatched', {
							count: stats.pairs,
							n: (chunks) => (
								<span className="text-text mr-1 font-mono text-[2rem] leading-none font-semibold tracking-[-0.03em]">
									{chunks}
								</span>
							)
						})}
					</span>
				)}
			</header>
			<p className="text-text-muted mt-1 text-sm">{status}</p>
			<h3 className="sr-only">{t('resultsTitle')}</h3>

			{showDrop ? (
				<div className="mt-4 space-y-3">
					<FileDrop
						label={t('dropTitle', { name: vendor.name })}
						hint={t('dropHint', {
							records: LIMITS.maxSourceRecords,
							megabytes: LIMITS.maxFileBytes / BYTES_PER_MB
						})}
						busyLabel={
							uploadPercent == null ? t('checking') : t('uploading', { percent: uploadPercent })
						}
						isBusy={isChecking}
						onFile={onFile}
					/>
					<p className="text-text-muted text-sm">
						{t.rich('sampleHint', {
							pairs: (chunks) => <SampleLink href={SAMPLE_FILES.vendorPairs}>{chunks}</SampleLink>,
							groups: (chunks) => <SampleLink href={SAMPLE_FILES.vendorGroups}>{chunks}</SampleLink>
						})}
					</p>
					{isReplacing && (
						<Button variant="quiet" size="sm" onClick={() => setIsReplacing(false)}>
							{t('cancel')}
						</Button>
					)}
				</div>
			) : (
				<>
					<div className="border-border bg-bg mt-[18px] flex flex-wrap items-center gap-3.5 rounded-[14px] border px-[18px] py-4">
						{fileName != null && (
							<TabularFileIcon
								fileName={fileName}
								size={FILE_ICON_SIZE}
								className="text-text shrink-0"
							/>
						)}
						<span className="min-w-0 flex-[1_1_200px]">
							<strong className="block truncate font-mono font-semibold">{fileName}</strong>
							{stats != null && (
								<span className="text-text-muted font-mono text-sm">
									{columns?.format === 'group' && stats.groups != null
										? t('metaGroups', { groups: stats.groups })
										: columns?.format === 'pair'
											? t('metaPairs', { rows: stats.rows })
											: t('metaRows', { rows: stats.rows })}
									{fileName != null && ` · ${fileType(fileName, checked?.sheet)}`}
								</span>
							)}
						</span>
						{isChecking && <SpinnerIcon className="text-text-muted" />}
						{isDraft && (
							<Button
								variant="secondary"
								onClick={() => setIsReplacing(true)}
								disabled={isChecking || isConfirming}
							>
								{t('replace')}
							</Button>
						)}
					</div>

					{columns != null && (
						<>
							<div className="mt-6 flex flex-wrap items-center justify-between gap-2">
								<p className="text-text-muted type-eyebrow">{t('howRead')}</p>
								{isDraft && file != null && (
									<Button
										variant="quiet"
										size="sm"
										className="-my-2"
										onClick={() => setIsChoosing((open) => !open)}
									>
										{isChoosing ? t('done') : t('change')}
									</Button>
								)}
							</div>
							<p className="border-border bg-bg text-text-muted mt-2.5 rounded-md border px-3.5 py-3 font-mono text-[0.8125rem] break-words">
								{columns.format === 'pair'
									? t.rich('readAsPair', { ...columns, col })
									: t.rich('readAsGroup', { ...columns, col })}
							</p>
						</>
					)}
					{sheets != null && file != null && (
						<div className="mt-3">
							<SheetPicker
								fileName={file.file.name}
								sheets={sheets}
								picked={sheet ?? null}
								isBusy={isChecking}
								onPick={pickSheet}
							/>
						</div>
					)}
					{checked?.detection != null && (
						<p role="alert" className="bg-warning-subtle text-warning mt-3 rounded-sm p-3 text-sm">
							{t(checked.detection.reason)}
						</p>
					)}

					{isDraft && isChoosing && checked != null && (
						<ColumnPicker headers={checked.headers} pending={pending} onChange={choose} />
					)}

					{stats != null && (
						<ul aria-label={t('statsLabel')} className="mt-4">
							{unknownCount === 0 && <Check>{t('checkKnown')}</Check>}
							<Check>{t('checkDuplicates', { count: stats.duplicates })}</Check>
							<Check>{t('checkSelf', { count: stats.selfPairs })}</Check>
							{suggestedOverlap != null && (
								<Check>
									{t.rich('checkSuggested', { ...suggestedOverlap, n: (chunks) => chunks })}
									<span className="text-text-muted block text-sm">
										{t('checkSuggestedNote', {
											rest: suggestedOverlap.total - suggestedOverlap.found
										})}
									</span>
								</Check>
							)}
						</ul>
					)}
				</>
			)}

			{(errors.length > 0 || issueMessages.length > 0) && (
				<div className="mt-4">
					<ValidationPanel title={t('errorsTitle')} messages={[...errors, ...issueMessages]} />
				</div>
			)}

			{!showDrop && (isDraft ? vendor.fileName != null || checked != null : true) && (
				<label
					className={cn(
						'border-border bg-bg mt-[18px] flex gap-3 rounded-[14px] border px-4 py-3.5 transition-[border-color] duration-150',
						isDraft && hasPassingFile
							? 'hover:border-border-strong cursor-pointer'
							: 'cursor-default'
					)}
				>
					<Checkbox
						checked={!isDraft}
						disabled={!isDraft || !hasPassingFile || isConfirming || isChecking}
						onCheckedChange={(value) => {
							if (value !== true) return
							startConfirming(async () => {
								const result = await confirmVendorAction({ draftId: vendor.id })
								if (!result.ok) {
									toast({ title: result.error, variant: 'destructive' })
									return
								}
								toast({ title: t('confirmed', { name: vendor.name }) })
								router.refresh()
							})
						}}
						className="data-[state=checked]:bg-text data-[state=checked]:text-bg data-[state=checked]:border-text mt-0.5 size-[22px] rounded-[6px] border-[1.5px] disabled:opacity-100"
					/>
					<span>
						<span className="font-semibold">{t('completeConfirm', { name: vendor.name })}</span>
						<span className="text-text-muted mt-0.5 block text-sm">
							{!isDraft && vendor.confirmedAt != null
								? t('confirmedOn', {
										date: format.dateTime(vendor.confirmedAt, { dateStyle: 'medium' })
									})
								: isConfirming
									? t('confirming')
									: hasPassingFile
										? t('completeExplanation')
										: t('completeNeedsFile')}
						</span>
					</span>
				</label>
			)}
			{remove != null && <div className="mt-auto flex justify-end pt-4">{remove}</div>}
		</article>
	)
}

// One check the file passed, with its tile.
function Check({ children }: { children: React.ReactNode }) {
	return (
		<li className="border-border flex items-start gap-3 border-t py-3">
			<Glyph kind="check" className="size-6 text-[0.8125rem]" />
			<span>{children}</span>
		</li>
	)
}

// The format, as two cards with a worked example each, and the two columns
// that format needs.
function ColumnPicker({
	headers,
	pending,
	onChange
}: {
	headers: string[]
	pending: Pending
	onChange: (next: Pending) => void
}) {
	const t = useTranslations('Vendors')
	const options = [
		{ value: '', label: t('chooseColumn') },
		...headers.map((header) => ({ value: header, label: header }))
	]
	const labels =
		pending.format === 'pair'
			? [t('columnA'), t('columnB')]
			: [t('groupColumn'), t('referenceColumn')]
	const isSame = pending.first !== '' && pending.first === pending.second
	return (
		<div className="border-border mt-4 rounded-sm border p-4">
			<p id="format-title" className="text-sm font-semibold">
				{t('formatTitle')}
			</p>
			<p className="text-text-muted mt-0.5 text-xs">{t('formatDescription')}</p>
			<div
				role="radiogroup"
				aria-labelledby="format-title"
				className="mt-3 grid gap-3 @3xl:grid-cols-2"
			>
				{FORMATS.map((option) => {
					const isSelected = pending.format === option
					return (
						<button
							key={option}
							type="button"
							role="radio"
							aria-checked={isSelected}
							onClick={() => {
								if (!isSelected) onChange({ format: option, first: '', second: '' })
							}}
							className={cn(
								'flex flex-col justify-start rounded-sm border p-3 text-left transition-[background-color,border-color] duration-150',
								isSelected
									? 'border-action bg-surface-hover'
									: 'border-border hover:bg-surface-hover'
							)}
						>
							<span className="type-ui flex items-center gap-2 font-medium">
								<span
									aria-hidden
									className={cn(
										'flex size-4 items-center justify-center rounded-full border',
										isSelected ? 'border-action' : 'border-border-input'
									)}
								>
									{isSelected && <span className="bg-action size-2 rounded-full" />}
								</span>
								{option === 'pair' ? t('formatPair') : t('formatGroup')}
							</span>
							<span className="text-text-muted mt-1 block text-xs">
								{option === 'pair' ? t('formatPairBody') : t('formatGroupBody')}
							</span>
							<FormatExample format={option} />
						</button>
					)
				})}
			</div>
			<div className="mt-4 grid gap-3 @3xl:grid-cols-2">
				{(['first', 'second'] as const).map((slot, index) => (
					<div key={slot}>
						<label htmlFor={`vendor-col-${slot}`} className="type-ui font-medium">
							{labels[index]}
						</label>
						<OptionSelect
							id={`vendor-col-${slot}`}
							className="mt-1.5"
							value={pending[slot]}
							options={options}
							aria-invalid={pending[slot] === '' || isSame}
							onValueChange={(value) => onChange({ ...pending, [slot]: value })}
						/>
					</div>
				))}
			</div>
			{isSame && <p className="text-danger mt-2 text-xs">{t('sameColumns')}</p>}
		</div>
	)
}

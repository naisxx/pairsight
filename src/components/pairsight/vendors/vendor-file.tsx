'use client'

import { useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RetryIcon, SpinnerIcon } from '@/components/ui/icons'
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
import { FileDrop } from '../file-drop'
import { TabularFileIcon, useFileTypeLabel } from '../file-type'
import { SheetPicker, type SheetChoice } from '../sheet-picker'
import { checkTabularFile, useFileErrorMessage, useRowList, ValidationPanel } from '../validation'
import { FormatExample } from './format-example'
import { VendorStats } from './vendor-stats'

type Checked = Extract<VendorFileCheck, { ok: true }>
type Pending = { format: VendorFormat; first: string; second: string }

const FILE_ICON_SIZE = 24
const SMALL_ICON_SIZE = 14
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

// A vendor's file: drop it in, and PairSight works out the format and columns
// from your records' references and checks every row. "Change" (or a file it
// can't read on its own) opens the format and column pickers. A file that
// passes is kept on the draft; confirming it complete makes the vendor ready.
export function VendorFile({ vendor, maxPairs }: { vendor: VendorListItem; maxPairs: number }) {
	const t = useTranslations('Vendors')
	const format = useFormatter()
	const router = useRouter()
	const fileError = useFileErrorMessage()
	const fileType = useFileTypeLabel()
	const list = useRowList()
	// The chosen file, kept as is so changing its columns sends it again, with
	// the workbook sheet it's read from (`sheet`) once one is picked.
	const [file, setFile] = useState<File | null>(null)
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

	function check(next: File, { columns, sheet }: { columns?: VendorColumns; sheet?: string } = {}) {
		setErrors([])
		startChecking(async () => {
			const result = await checkVendorFileAction({
				draftId: vendor.id,
				file: next,
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
		setFile(chosen)
		setSheet(undefined)
		setSheets(null)
		check(chosen)
	}

	function pickSheet(name: string) {
		if (file == null) return
		setSheet(name)
		check(file, { sheet: name })
	}

	function choose(next: Pending) {
		setPending(next)
		const columns = fromPending(next)
		if (file != null && columns != null) check(file, { columns, sheet })
	}

	const showDrop = isDraft && (isReplacing || (file == null && vendor.fileName == null))
	const columns = checked?.columns ?? (file == null ? vendor.columns : null)
	const stats = checked?.stats ?? (file == null ? vendor.stats : null)
	const issues = checked?.issues ?? null
	const hasPassingFile =
		isDraft && vendor.fileName != null && issues == null && checked?.detection == null
	const fileName = file?.name ?? vendor.fileName
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
	const col = (chunks: React.ReactNode) => <span className="text-text font-mono">{chunks}</span>

	return (
		<section
			aria-labelledby={`file-${vendor.id}`}
			className="border-border bg-surface rounded-md border p-4"
		>
			<h2 id={`file-${vendor.id}`} className="text-sm font-semibold">
				{t('resultsTitle')}
			</h2>

			{showDrop ? (
				<div className="mt-3 space-y-3">
					<FileDrop
						label={t('dropTitle', { name: vendor.name })}
						hint={t('dropHint')}
						busyLabel={t('checking')}
						isBusy={isChecking}
						onFile={onFile}
					/>
					{isReplacing && (
						<Button variant="quiet" size="sm" onClick={() => setIsReplacing(false)}>
							{t('cancel')}
						</Button>
					)}
				</div>
			) : (
				<>
					<div className="mt-3 flex flex-wrap items-center gap-3">
						{fileName != null && (
							<TabularFileIcon
								fileName={fileName}
								size={FILE_ICON_SIZE}
								className="text-text-muted shrink-0"
							/>
						)}
						<div className="min-w-0 flex-1">
							<p className="type-ui truncate font-mono font-medium">{fileName}</p>
							{stats != null && (
								<p className="text-text-muted text-xs">
									{checked == null
										? t.rich('fileMeta', { rows: stats.rows, n: col })
										: t.rich('fileMetaColumns', {
												rows: stats.rows,
												columns: checked.headers.length,
												n: col
											})}
									{fileName != null && ` · ${fileType(fileName, checked?.sheet)}`}
								</p>
							)}
						</div>
						{isChecking && <SpinnerIcon className="text-text-muted" />}
						{isDraft && (
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setIsReplacing(true)}
								disabled={isChecking || isConfirming}
							>
								<RetryIcon size={SMALL_ICON_SIZE} />
								{t('replace')}
							</Button>
						)}
					</div>

					{columns != null && (
						<p className="type-ui text-text-muted mt-3 flex flex-wrap items-center gap-x-2">
							<span>
								{columns.format === 'pair'
									? t.rich('readAsPair', { ...columns, col })
									: t.rich('readAsGroup', { ...columns, col })}
							</span>
							{isDraft && file != null && (
								<Button
									variant="quiet"
									size="sm"
									className="h-7 px-2"
									onClick={() => setIsChoosing((open) => !open)}
								>
									{isChoosing ? t('done') : t('change')}
								</Button>
							)}
						</p>
					)}
					{sheets != null && file != null && (
						<div className="mt-3">
							<SheetPicker
								fileName={file.name}
								sheets={sheets}
								picked={sheet ?? null}
								isBusy={isChecking}
								onPick={pickSheet}
							/>
						</div>
					)}
					{checked?.detection != null && (
						<p role="alert" className="bg-warning-subtle text-warning type-ui mt-3 rounded-sm p-3">
							{t(checked.detection.reason)}
						</p>
					)}

					{isDraft && isChoosing && checked != null && (
						<ColumnPicker headers={checked.headers} pending={pending} onChange={choose} />
					)}

					{stats != null && <VendorStats stats={stats} unknownCount={issues?.unknownCount ?? 0} />}
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
						'mt-4 flex gap-3 rounded-sm border p-3 transition-[background-color,border-color] duration-150',
						// Confirmed reads as done (success), never as the coral of an error.
						!isDraft ? 'border-success bg-success-subtle' : 'border-border-input',
						isDraft && hasPassingFile ? 'cursor-pointer' : 'cursor-default'
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
						className="mt-0.5"
					/>
					<span className="type-ui">
						<span className="font-medium">{t('completeConfirm', { name: vendor.name })}</span>
						<span className="text-text-muted mt-0.5 block text-xs">
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
		</section>
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

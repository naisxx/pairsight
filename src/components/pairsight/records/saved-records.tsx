'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { EXACT_FORMATS } from '@/i18n/formats'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ArrowRightIcon, FileIcon } from '@/components/ui/icons'
import type { EntityType } from '@/lib/pairsight/entity-types'
import type { FieldRole } from '@/server/pairsight/fields'
import { useFileTypeLabel } from '../file-type'
import { Glyph } from '../glyph'
import { ActionBar } from '../step-layout'
import { fieldFor, savedMapping, type FieldKey } from './mapping'
import { RecordsUploader } from './records-uploader'
import { useEvaluationView } from '../evaluation-context'
import { ReadOnlyGate } from '../read-only'

const ICON_SIZE = 15
const FILE_ICON_SIZE = 22
const BYTES_PER_MB = 1_000_000

// A choice made when the file was saved, shown as it was made: a saved
// dataset is fixed.
function SavedChoice({
	id,
	label,
	value,
	hint
}: {
	id: string
	label: string
	value: string
	hint: string
}) {
	return (
		<div className="min-w-0 flex-[1_1_220px]">
			<p id={id} className="mb-1.5 text-sm font-semibold">
				{label}
			</p>
			<p
				aria-labelledby={id}
				className="border-border-input bg-surface text-text flex h-11 items-center truncate rounded-md border px-3 text-[0.9375rem]"
			>
				{value}
			</p>
			<p className="text-text-muted mt-1.5 text-sm">{hint}</p>
		</div>
	)
}

function Check({ title, detail }: { title: string; detail?: string }) {
	return (
		<li className="border-border flex items-start gap-3 border-t py-3">
			<Glyph kind="check" className="size-6 text-[0.8125rem]" />
			<span>
				{title}
				{detail != null && <span className="text-text-muted block text-sm">{detail}</span>}
			</span>
		</li>
	)
}

// The saved records file (pairsight-handoff Records): the file, the record
// ID column and the type of record it was saved with, its first rows headed
// by the fields they're mapped to, and what PairSight checked on the way in.
// Read-only (a saved dataset is fixed); replacing it asks first, then shows
// the uploader in its place, with a way back.
export function SavedRecords({
	evaluationId,
	entityType,
	fileName,
	savedAt,
	rowCount,
	headers,
	referenceColumn,
	columnRoles,
	mappedCount,
	rows,
	limits,
	health
}: {
	evaluationId: string
	entityType: EntityType
	fileName: string
	savedAt: Date
	rowCount: number
	headers: string[]
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	// How many columns are mapped to a field Jev can compare.
	mappedCount: number
	rows: Array<{ rowNumber: number; cells: string[] }>
	// The uploader's limits, said under the demo's drop zone.
	limits: { records: number; bytes: number }
	// What PairSight noticed in the file (data-health.tsx), when profiled.
	health: React.ReactNode
}) {
	const t = useTranslations('Records')
	const tRoles = useTranslations('Roles')
	const tTypes = useTranslations('EntityTypes')
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
	const card = 'bg-surface border-border min-w-0 rounded-lg border p-6 md:p-7'
	return (
		<>
			<div className="flex flex-wrap items-start gap-4">
				<section aria-labelledby="file-title" className={`${card} flex-[2_1_560px]`}>
					<h2 id="file-title" className="text-text-muted type-eyebrow">
						{t('fileLabel')}
					</h2>
					<div
						role="group"
						aria-label={t('fileDetails')}
						className="border-border bg-bg mt-3.5 flex flex-wrap items-center gap-3.5 rounded-[14px] border px-[18px] py-4"
					>
						<FileIcon size={FILE_ICON_SIZE} className="text-text shrink-0" />
						<span
							className="min-w-0 flex-[1_1_200px]"
							title={t('savedOn', { date: format.dateTime(savedAt, { dateStyle: 'medium' }) })}
						>
							<strong className="block truncate font-mono font-semibold">{fileName}</strong>
							<span className="text-text-muted font-mono text-sm">
								{t(
									'fileSummary',
									{ rows: rowCount, columns: headers.length, type: fileType(fileName) },
									EXACT_FORMATS
								)}
							</span>
						</span>
						<ReadOnlyGate action="upload">
							<Button variant="secondary" onClick={() => setIsConfirming(true)}>
								{t('replace')}
							</Button>
						</ReadOnlyGate>
					</div>

					<div className="mt-6 flex flex-wrap gap-4">
						<SavedChoice
							id="saved-id-column"
							label={t('idColumnLabel')}
							value={referenceColumn}
							hint={t('idColumnHint')}
						/>
						<SavedChoice
							id="saved-type"
							label={t('typeLabel')}
							value={tTypes('name', { type: entityType })}
							hint={t('typeHint')}
						/>
					</div>

					<h3 id="first-rows-title" className="text-text-muted type-eyebrow mt-8">
						{t('firstRows')}
					</h3>
					{/* Focusable, so the keyboard can scroll it sideways. */}
					<div
						role="region"
						tabIndex={0}
						aria-labelledby="first-rows-title"
						className="scroll-fade-x mt-3 overflow-x-auto"
					>
						<table className="w-full border-collapse font-mono text-[0.8125rem] whitespace-nowrap">
							<caption className="sr-only">{t('previewCaption')}</caption>
							<thead>
								<tr>
									{headers.map((header) => {
										const field = fieldFor(mapping, header)
										return (
											<th
												key={header}
												scope="col"
												title={header}
												className={`py-2.5 pr-4 text-left text-[0.6875rem] font-normal tracking-[0.06em] uppercase ${
													field == null ? 'text-text-muted/70' : 'text-text-muted'
												}`}
											>
												{field == null ? header : label(field)}
											</th>
										)
									})}
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.rowNumber} className="border-border border-t">
										{headers.map((header, index) => {
											const value = row.cells[index] ?? ''
											return (
												<td key={header} className="text-text py-2.5 pr-4">
													{value.trim() === '' ? (
														<span className="text-text-muted font-sans italic">{t('missing')}</span>
													) : (
														value
													)}
												</td>
											)
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="text-text-muted mt-3 text-sm">
						{t('firstRowsNote', { shown: rows.length, total: rowCount }, EXACT_FORMATS)}
					</p>
				</section>

				<section aria-labelledby="checks-title" className={`${card} flex-[1_1_320px]`}>
					<h2 id="checks-title" className="text-text-muted type-eyebrow">
						{t('checksTitle')}
					</h2>
					{/* Saved, every check passed: a file that fails one can't be saved. */}
					<ul className="mt-3.5">
						<Check
							title={t('checkRead')}
							detail={t(
								'checkReadDetail',
								{ rows: rowCount, columns: headers.length },
								EXACT_FORMATS
							)}
						/>
						<Check title={t('checkIds')} />
						<Check title={t('checkUnique')} />
						<Check
							title={t('checkColumns')}
							detail={mappedCount >= 2 ? t('checkColumnsDetail') : undefined}
						/>
					</ul>
					<p className="border-border text-text-muted mt-1 border-t pt-4 text-sm">
						{view.isReadOnly ? t('privacyNoteDemo') : t('privacyNote')}
					</p>
				</section>
			</div>
			{health != null && <div className="mt-4">{health}</div>}
			{view.isReadOnly && (
				<p className="border-border-strong text-text-muted mt-4 rounded-[16px] border-[1.5px] border-dashed p-7 text-center">
					<strong className="text-text block">{t('dropDemoTitle')}</strong>
					{t('dropDemoHint', {
						records: limits.records,
						megabytes: limits.bytes / BYTES_PER_MB
					})}
				</p>
			)}

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

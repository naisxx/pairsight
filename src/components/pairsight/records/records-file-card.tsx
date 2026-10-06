'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDownIcon, SuccessIcon, WarningCircleIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { Count } from '@/components/ui/count'
import { TabularFileIcon } from '../file-type'

const ICON_SIZE = 26
const CHIP_ICON_SIZE = 14

export type IdStatus =
	{ kind: 'good'; count: number } | { kind: 'problems'; count: number } | { kind: 'missing' }

// The records file in one card (docs/PairSight-UX-Plan.md): which file, how
// big, whether its IDs are fine, and what we matched its columns to, on one
// screen. The column table and the first rows sit behind two toggles, since
// our suggestions are right most of the time. The columns open by themselves,
// and stay open, while something needs you (`needsReview`); an ID problem
// shows its rows straight away (`problems`).
export function RecordsFileCard({
	fileName,
	meta,
	rows,
	columns,
	action,
	idStatus,
	matchedFields,
	needsReview,
	problems,
	columnsPanel,
	previewPanel
}: {
	fileName: string
	meta: string
	rows: number
	columns: number
	action: React.ReactNode
	idStatus: IdStatus
	// The fields we matched to its columns, in field order.
	matchedFields: string[]
	needsReview: boolean
	problems: React.ReactNode
	columnsPanel: React.ReactNode
	previewPanel: React.ReactNode
}) {
	const t = useTranslations('Records')
	const [isColumnsChosen, setIsColumnsChosen] = useState(false)
	const [isPreviewOpen, setIsPreviewOpen] = useState(false)
	const isColumnsOpen = needsReview || isColumnsChosen
	return (
		<section aria-label={t('fileDetails')} className="border-border bg-surface rounded-md border">
			<header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
				<div className="flex min-w-0 items-center gap-3">
					<TabularFileIcon
						fileName={fileName}
						size={ICON_SIZE}
						className="text-text-muted shrink-0"
					/>
					<div className="min-w-0">
						<p className="type-ui truncate font-mono font-medium">{fileName}</p>
						<p className="text-text-muted text-xs">{meta}</p>
					</div>
				</div>
				<dl className="type-ui flex flex-wrap gap-x-6 gap-y-1">
					<div>
						<dt className="text-text-muted text-xs">{t('rows')}</dt>
						<dd className="font-mono">
							<Count value={rows} />
						</dd>
					</div>
					<div>
						<dt className="text-text-muted text-xs">{t('columns')}</dt>
						<dd className="font-mono">
							<Count value={columns} />
						</dd>
					</div>
				</dl>
				<IdChip status={idStatus} />
				<div className="ml-auto">{action}</div>
			</header>

			{problems}

			<div className="border-border border-t px-4 py-3">
				<p className="type-ui text-text-muted">
					{t('mappingSummary', { mapped: matchedFields.length, total: columns })}
				</p>
				<ul
					aria-label={t('mappedFields')}
					className="mt-2 flex gap-1.5 overflow-hidden whitespace-nowrap"
				>
					{matchedFields.map((field) => (
						<li
							key={field}
							className="border-border bg-surface-muted type-caption shrink-0 rounded-[6px] border px-2 py-0.5"
						>
							{field}
						</li>
					))}
				</ul>
			</div>

			<div className="border-border flex flex-wrap gap-x-6 gap-y-1 border-t px-4 py-2">
				{!needsReview && (
					<Toggle
						isOpen={isColumnsOpen}
						controls="records-columns"
						onClick={() => setIsColumnsChosen((current) => !current)}
					>
						{isColumnsOpen ? t('hideColumns') : t('reviewColumns')}
					</Toggle>
				)}
				<Toggle
					isOpen={isPreviewOpen}
					controls="records-preview"
					onClick={() => setIsPreviewOpen((current) => !current)}
				>
					{isPreviewOpen ? t('hidePreview') : t('showPreview')}
				</Toggle>
			</div>
			<div id="records-columns" hidden={!isColumnsOpen} className="border-border border-t">
				{columnsPanel}
			</div>
			<div id="records-preview" hidden={!isPreviewOpen} className="border-border border-t">
				{previewPanel}
			</div>
		</section>
	)
}

function Toggle({
	isOpen,
	controls,
	onClick,
	children
}: {
	isOpen: boolean
	controls: string
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			aria-expanded={isOpen}
			aria-controls={controls}
			onClick={onClick}
			className="type-ui text-accent-ink inline-flex items-center gap-1.5 py-1 font-medium hover:underline"
		>
			<ChevronDownIcon
				size={CHIP_ICON_SIZE}
				className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
			/>
			{children}
		</button>
	)
}

// Whether every record has its own ID, at a glance.
function IdChip({ status }: { status: IdStatus }) {
	const t = useTranslations('Records')
	const isGood = status.kind === 'good'
	return (
		<p
			className={cn(
				'type-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
				isGood ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
			)}
		>
			{isGood ? (
				<SuccessIcon size={CHIP_ICON_SIZE} variant="solid" />
			) : (
				<WarningCircleIcon size={CHIP_ICON_SIZE} />
			)}
			{status.kind === 'good'
				? t('idChipGood', { count: status.count })
				: status.kind === 'problems'
					? t('idChipProblems', { count: status.count })
					: t('idChipMissing')}
		</p>
	)
}

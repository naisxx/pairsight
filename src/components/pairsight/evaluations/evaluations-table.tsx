'use client'

import { useState, useTransition } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useFormatter, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
	CloseIcon,
	TrashIcon,
	EditIcon,
	FolderIcon,
	MoreHorizontalIcon,
	SearchIcon,
	SpinnerIcon
} from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import type { EvaluationStatus, StageKey, StageState } from '@/lib/pairsight/stages'
import {
	deleteEvaluationAction,
	renameEvaluationAction
} from '@/server/actions/pairsight/evaluations'
import { EvaluationStatusChip } from '../shell/status-chip'
import { NameDialog } from './name-dialog'
import { StageProgress } from './stage-progress'

const ICON_SIZE = 15
const MORE_ICON_SIZE = 18
const ROW_FADE_S = 0.2
const ROW_STAGGER_S = 0.04
const MAX_ROW_DELAY_S = 0.2

export type TableRow = {
	id: string
	href: string
	name: string
	createdAt: Date
	updatedAt: Date
	status: EvaluationStatus
	stages: Array<{ key: StageKey; state: StageState }>
	nextKey: StageKey | null
	recordCount: number | null
	vendorCount: number
	lastRunAt: Date | null
}

// "All evaluations": searchable by name, each row opening its evaluation,
// with Open, Rename and Delete in a row menu (Open only when read-only).
export function EvaluationsTable({ rows, isReadOnly }: { rows: TableRow[]; isReadOnly: boolean }) {
	const t = useTranslations('Evaluations')
	const tSteps = useTranslations('Steps')
	const format = useFormatter()
	const router = useRouter()
	const isReduced = useReducedMotion() === true
	const [query, setQuery] = useState('')
	const [renaming, setRenaming] = useState<TableRow | null>(null)
	const [deleting, setDeleting] = useState<TableRow | null>(null)
	const [isDeleting, startDelete] = useTransition()
	const needle = query.trim().toLowerCase()
	const shown = rows.filter((row) => row.name.toLowerCase().includes(needle))
	const date = (value: Date) => format.dateTime(value, { dateStyle: 'medium' })
	const th =
		'border-border text-text-muted h-9 border-b px-4 text-left text-xs font-medium whitespace-nowrap'
	const td = 'border-border h-14 border-b px-4 align-middle'

	return (
		<section aria-labelledby="all-title">
			<div className="mt-8 flex flex-wrap items-center justify-between gap-3">
				<h2 id="all-title" className="text-[15px] font-semibold">
					{t('allTitle')}
				</h2>
				<div className="relative w-full sm:w-[300px]">
					<SearchIcon
						size={ICON_SIZE}
						className="text-text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
					/>
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t('search')}
						aria-label={t('search')}
						className="type-ui h-8 pl-8"
					/>
				</div>
			</div>

			{shown.length === 0 ? (
				<div className="border-border bg-surface mt-3 flex flex-col items-center rounded-md border px-6 py-12 text-center">
					<p className="text-sm font-semibold">{t('noMatch', { query: query.trim() })}</p>
					<Button variant="quiet" size="sm" className="mt-2" onClick={() => setQuery('')}>
						<CloseIcon size={13} />
						{t('clearSearch')}
					</Button>
				</div>
			) : (
				<div className="border-border bg-surface relative mt-3 overflow-x-auto rounded-md border">
					<table className="type-ui w-full min-w-[900px] border-separate border-spacing-0">
						<caption className="sr-only">{t('caption')}</caption>
						<thead className="bg-surface-muted">
							<tr>
								<th scope="col" className={th}>
									{t('colName')}
								</th>
								<th scope="col" className={th}>
									{t('colStatus')}
								</th>
								<th scope="col" className={th}>
									{t('colProgress')}
								</th>
								<th scope="col" className={`${th} text-right`}>
									{t('colRecords')}
								</th>
								<th scope="col" className={`${th} text-right`}>
									{t('colVendors')}
								</th>
								<th scope="col" className={th}>
									{t('colLastRun')}
								</th>
								<th scope="col" className={th}>
									{t('colUpdated')}
								</th>
								<th scope="col" className={th}>
									<span className="sr-only">{t('colActions')}</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{shown.map((row, index) => {
								const { href } = row
								return (
									<motion.tr
										key={row.id}
										initial={isReduced ? false : { opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{
											duration: ROW_FADE_S,
											delay: Math.min(index * ROW_STAGGER_S, MAX_ROW_DELAY_S)
										}}
										className="hover:bg-surface-hover cursor-pointer transition-colors duration-100"
										onClick={() => router.push(href)}
									>
										<td className={td}>
											<Link
												href={href}
												className="text-text font-medium hover:underline"
												onClick={(event) => event.stopPropagation()}
											>
												{row.name}
											</Link>
											<span className="text-text-muted block text-xs">
												{t('created', { date: date(row.createdAt) })}
											</span>
										</td>
										<td className={td}>
											<EvaluationStatusChip status={row.status} />
										</td>
										<td className={td}>
											<StageProgress stages={row.stages} />
											<span className="text-text-muted type-caption mt-1 block">
												{row.nextKey == null
													? t('allStagesDone')
													: t('nextPlain', { stage: tSteps(row.nextKey) })}
											</span>
										</td>
										<td className={`${td} text-right font-mono`}>{row.recordCount ?? '—'}</td>
										<td className={`${td} text-right font-mono`}>
											{row.vendorCount === 0 ? '—' : row.vendorCount}
										</td>
										<td className={`${td} text-text-muted`}>
											{row.lastRunAt == null
												? t('never')
												: format.dateTime(row.lastRunAt, {
														dateStyle: 'medium',
														timeStyle: 'short'
													})}
										</td>
										<td className={`${td} text-text-muted`}>{date(row.updatedAt)}</td>
										<td
											className={`${td} w-12 text-right`}
											onClick={(event) => event.stopPropagation()}
										>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="quiet"
														size="icon"
														aria-label={t('actionsFor', { name: row.name })}
													>
														<MoreHorizontalIcon size={MORE_ICON_SIZE} variant="bold" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem onSelect={() => router.push(href)}>
														<FolderIcon size={ICON_SIZE} />
														{t('open')}
													</DropdownMenuItem>
													{!isReadOnly && (
														<>
															<DropdownMenuItem onSelect={() => setRenaming(row)}>
																<EditIcon size={ICON_SIZE} />
																{t('rename')}
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																variant="destructive"
																onSelect={() => setDeleting(row)}
															>
																<TrashIcon size={ICON_SIZE} />
																{t('delete')}
															</DropdownMenuItem>
														</>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</td>
									</motion.tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			<NameDialog
				open={renaming != null}
				onOpenChange={(open) => {
					if (!open) setRenaming(null)
				}}
				title={t('renameTitle')}
				initialName={renaming?.name ?? ''}
				submitLabel={t('saveName')}
				pendingLabel={t('saving')}
				takenNames={rows.filter((row) => row.id !== renaming?.id).map((row) => row.name)}
				onSubmit={async (name) => {
					if (renaming == null) return null
					const result = await renameEvaluationAction({ evaluationId: renaming.id, name })
					if (!result.ok) return result.error
					setRenaming(null)
					toast({ title: t('nameSaved') })
					router.refresh()
					return null
				}}
			/>

			<Dialog
				open={deleting != null}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setDeleting(null)
				}}
				title={t('deleteTitle')}
				description={
					deleting == null
						? undefined
						: t.rich('deleteDescription', {
								name: deleting.name,
								b: (chunks) => <span className="text-text font-medium">{chunks}</span>
							})
				}
				closeLabel={t('close')}
				width="sm"
				footer={
					<>
						<Button variant="secondary" onClick={() => setDeleting(null)} disabled={isDeleting}>
							{t('cancel')}
						</Button>
						<Button
							variant="danger"
							disabled={isDeleting}
							onClick={() => {
								if (deleting == null) return
								const { id } = deleting
								startDelete(async () => {
									const result = await deleteEvaluationAction({ evaluationId: id })
									if (!result.ok) {
										toast({ title: result.error, variant: 'destructive' })
										return
									}
									setDeleting(null)
									toast({ title: t('deleted') })
									router.refresh()
								})
							}}
						>
							{isDeleting ? <SpinnerIcon size={ICON_SIZE} /> : <TrashIcon size={ICON_SIZE} />}
							{isDeleting ? t('deleting') : t('deleteConfirm')}
						</Button>
					</>
				}
			/>
		</section>
	)
}

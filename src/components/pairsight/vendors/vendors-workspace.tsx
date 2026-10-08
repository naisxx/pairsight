'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
	ArrowRightIcon,
	InfoIcon,
	PlusIcon,
	SpinnerIcon,
	SuccessIcon,
	TrashIcon
} from '@/components/ui/icons'
import { EmptyState } from '../empty-state'
import { NoVendorsScene } from '../empty/scenes'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { toast } from '@/lib/toast'
import {
	createVendorDraftAction,
	deleteVendorAction,
	renameVendorAction
} from '@/server/actions/pairsight/vendors'
import type { VendorListItem } from '@/server/pairsight/vendor-exports'
import { ACTION_HINT_ID, ActionBar } from '../step-layout'
import { VendorFile } from './vendor-file'
import { useEvaluationView } from '../evaluation-context'
import { ReadOnlyFieldset, ReadOnlyGate } from '../read-only'

const ICON_SIZE = 15
const STATUS_ICON_SIZE = 17

type MissingStep = 'stepName' | 'stepFile' | 'stepConfirm'

// What a vendor still needs before it's ready; null once it is.
function missingStep(vendor: VendorListItem): MissingStep | null {
	if (vendor.kind === 'export') return null
	if (vendor.name.trim() === '') return 'stepName'
	return vendor.fileName == null ? 'stepFile' : 'stepConfirm'
}

// The Vendors step: a list of vendors on the left (ready, or what each still
// needs), the selected one's editor on the right, and Continue once every
// vendor is ready. Vendors are saved as you go, so leaving half-way is fine.
export function VendorsWorkspace({
	evaluationId,
	vendors,
	maxVendors,
	maxPairs
}: {
	evaluationId: string
	vendors: VendorListItem[]
	maxVendors: number
	maxPairs: number
}) {
	const t = useTranslations('Vendors')
	const router = useRouter()
	const view = useEvaluationView()
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [removing, setRemoving] = useState<VendorListItem | null>(null)
	const [isAdding, startAdding] = useTransition()
	const [isRemoving, startRemoving] = useTransition()
	const firstUnfinished = vendors.find((vendor) => missingStep(vendor) != null)
	const current =
		vendors.find((vendor) => vendor.id === selectedId) ?? firstUnfinished ?? vendors[0] ?? null
	const canAdd = vendors.length < maxVendors
	const unfinishedStep = firstUnfinished == null ? null : missingStep(firstUnfinished)
	const blockedReason =
		vendors.length === 0
			? t('blockedNone')
			: firstUnfinished != null && unfinishedStep != null
				? t('blockedUnfinished', { name: firstUnfinished.name, step: t(unfinishedStep) })
				: null

	function add() {
		startAdding(async () => {
			const result = await createVendorDraftAction({ evaluationId })
			if (!result.ok) {
				toast({ title: result.error, variant: 'destructive' })
				return
			}
			setSelectedId(result.data.id)
			router.refresh()
		})
	}

	const addButton = (
		<ReadOnlyGate action="vendor">
			<Button
				variant="quiet"
				size="sm"
				className="w-full justify-start"
				onClick={add}
				disabled={!canAdd || isAdding}
			>
				{isAdding ? <SpinnerIcon size={ICON_SIZE} /> : <PlusIcon size={ICON_SIZE} />}
				{isAdding ? t('adding') : t('add')}
			</Button>
		</ReadOnlyGate>
	)

	return (
		<>
			{current == null ? (
				<EmptyState
					framed
					scene={<NoVendorsScene />}
					title={t('emptyTitle')}
					description={t('emptyDescription', { max: maxVendors })}
					actions={
						<Button onClick={add} disabled={isAdding}>
							{isAdding ? <SpinnerIcon size={ICON_SIZE} /> : <PlusIcon size={ICON_SIZE} />}
							{isAdding ? t('adding') : t('add')}
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12">
					<nav aria-label={t('listLabel')} className="@5xl:col-span-3">
						<ul className="relative flex gap-2 overflow-x-auto @5xl:flex-col @5xl:gap-1">
							{vendors.map((vendor) => {
								const step = missingStep(vendor)
								const isSelected = vendor.id === current.id
								return (
									<li key={vendor.id} className="shrink-0">
										<button
											type="button"
											onClick={() => setSelectedId(vendor.id)}
											aria-current={isSelected ? 'true' : undefined}
											className={cn(
												'flex w-full min-w-[180px] items-center gap-2.5 rounded-sm border px-3 py-2.5 text-left transition-[background-color,border-color] duration-150',
												isSelected
													? 'border-border bg-surface-hover shadow-[inset_2px_0_0_var(--action)]'
													: 'hover:bg-surface-hover border-transparent'
											)}
										>
											{step == null ? (
												<SuccessIcon
													size={STATUS_ICON_SIZE}
													variant="solid"
													className="text-text shrink-0"
												/>
											) : (
												<span
													aria-hidden
													className="border-text-muted size-[15px] shrink-0 rounded-full border-[1.5px] border-dashed"
												/>
											)}
											<span className="min-w-0">
												<span className="type-ui block truncate font-medium">
													{vendor.name === '' ? t('untitled') : vendor.name}
												</span>
												<span className="text-text-muted type-caption block">
													{step == null
														? t('statusReady', { format: vendor.format ?? 'pair' })
														: t('needs', { step: t(step) })}
												</span>
											</span>
										</button>
									</li>
								)
							})}
							<li className="shrink-0">
								{canAdd ? (
									addButton
								) : (
									<p className="text-text-muted type-caption px-3 py-2">
										{t('maxVendors', { max: maxVendors })}
									</p>
								)}
							</li>
						</ul>
					</nav>
					<ReadOnlyFieldset className="space-y-4 @5xl:col-span-9">
						<VendorName
							key={`name-${current.id}`}
							vendor={current}
							onRemove={() => setRemoving(current)}
						/>
						<VendorFile key={`file-${current.id}`} vendor={current} maxPairs={maxPairs} />
					</ReadOnlyFieldset>
				</div>
			)}

			<ActionBar
				back={{ href: `${view.base}/records`, label: t('back') }}
				hint={
					blockedReason == null ? undefined : (
						<>
							<InfoIcon size={ICON_SIZE} className="shrink-0" />
							<span>{blockedReason}</span>
						</>
					)
				}
			>
				{blockedReason == null ? (
					<Button asChild>
						<Link href={`${view.base}/rules`}>
							{t('continue')}
							<ArrowRightIcon size={ICON_SIZE} />
						</Link>
					</Button>
				) : (
					<Button disabled aria-describedby={ACTION_HINT_ID}>
						{t('continue')}
						<ArrowRightIcon size={ICON_SIZE} />
					</Button>
				)}
			</ActionBar>

			<Dialog
				open={removing != null}
				onOpenChange={(open) => {
					if (!open && !isRemoving) setRemoving(null)
				}}
				title={t('removeTitle', { name: removing?.name ?? '' })}
				description={t('removeDescription')}
				closeLabel={t('close')}
				width="sm"
				footer={
					<>
						<Button variant="secondary" onClick={() => setRemoving(null)} disabled={isRemoving}>
							{t('cancel')}
						</Button>
						<Button
							variant="danger"
							disabled={isRemoving}
							onClick={() => {
								if (removing == null) return
								const { kind, id, name } = removing
								startRemoving(async () => {
									const result = await deleteVendorAction({ kind, id })
									if (!result.ok) {
										toast({ title: result.error, variant: 'destructive' })
										return
									}
									setRemoving(null)
									setSelectedId(null)
									toast({ title: t('removed', { name }) })
									router.refresh()
								})
							}}
						>
							{isRemoving ? <SpinnerIcon size={ICON_SIZE} /> : <TrashIcon size={ICON_SIZE} />}
							{isRemoving ? t('removing') : t('remove')}
						</Button>
					</>
				}
			/>
		</>
	)
}

// The vendor's name, saved when you leave the field, and its Remove button.
function VendorName({ vendor, onRemove }: { vendor: VendorListItem; onRemove: () => void }) {
	const t = useTranslations('Vendors')
	const router = useRouter()
	const [name, setName] = useState(vendor.name)
	const [error, setError] = useState<string | null>(null)
	const [isSaving, startSaving] = useTransition()
	const id = `vendor-name-${vendor.id}`

	function save() {
		const trimmed = name.trim()
		if (trimmed === vendor.name) return
		if (trimmed === '') {
			setError(t('nameRequired'))
			return
		}
		setError(null)
		startSaving(async () => {
			const result = await renameVendorAction({ kind: vendor.kind, id: vendor.id, name: trimmed })
			if (!result.ok) return setError(result.error)
			toast({ title: t('nameSaved') })
			router.refresh()
		})
	}

	return (
		<section className="border-border bg-surface rounded-lg border p-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[220px] flex-1">
					<label htmlFor={id} className="type-ui font-medium">
						{t('nameLabel')}
					</label>
					<Input
						id={id}
						className="mt-1.5"
						value={name}
						maxLength={NAME_MAX_LENGTH}
						disabled={isSaving}
						onChange={(event) => {
							setName(event.target.value)
							setError(null)
						}}
						onBlur={save}
						onKeyDown={(event) => {
							if (event.key === 'Enter') event.currentTarget.blur()
						}}
						aria-invalid={error != null}
						aria-describedby={error == null ? undefined : `${id}-error`}
					/>
					{error != null && (
						<p id={`${id}-error`} className="text-danger mt-1 text-xs">
							{error}
						</p>
					)}
				</div>
				<Button variant="danger" onClick={onRemove}>
					<TrashIcon size={ICON_SIZE} />
					{t('remove')}
				</Button>
			</div>
		</section>
	)
}

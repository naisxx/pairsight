'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ArrowRightIcon, InfoIcon, PlusIcon, SpinnerIcon, TrashIcon } from '@/components/ui/icons'
import { EmptyState } from '../empty-state'
import { NoVendorsScene } from '../empty/scenes'
import { Input } from '@/components/ui/input'
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

type MissingStep = 'stepName' | 'stepFile' | 'stepConfirm'

// What a vendor still needs before it's ready; null once it is.
function missingStep(vendor: VendorListItem): MissingStep | null {
	if (vendor.kind === 'export') return null
	if (vendor.name.trim() === '') return 'stepName'
	return vendor.fileName == null ? 'stepFile' : 'stepConfirm'
}

// The Vendors step (pairsight-handoff Vendors): a card per vendor, side by
// side, each its own editor (name, file, how it was read, the checks, and
// confirming it complete), then the way to add another, and Continue once
// every vendor is ready. Vendors are saved as you go, so leaving half-way is
// fine.
export function VendorsWorkspace({
	evaluationId,
	vendors,
	maxVendors,
	maxPairs,
	suggestedOverlap
}: {
	evaluationId: string
	vendors: VendorListItem[]
	maxVendors: number
	maxPairs: number
	// For each ready vendor: how many of its pairs PairSight suggests anyway.
	suggestedOverlap: Record<string, { found: number; total: number }>
}) {
	const t = useTranslations('Vendors')
	const router = useRouter()
	const view = useEvaluationView()
	const [removing, setRemoving] = useState<VendorListItem | null>(null)
	const [isAdding, startAdding] = useTransition()
	const [isRemoving, startRemoving] = useTransition()
	const firstUnfinished = vendors.find((vendor) => missingStep(vendor) != null)
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
			router.refresh()
		})
	}

	return (
		<>
			{vendors.length === 0 ? (
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
				<>
					<section
						aria-label={t('listLabel')}
						className="grid grid-cols-1 items-start gap-4 @5xl:grid-cols-2"
					>
						{vendors.map((vendor, index) => {
							const step = missingStep(vendor)
							return (
								<ReadOnlyFieldset key={vendor.id}>
									<VendorFile
										vendor={vendor}
										index={index}
										maxPairs={maxPairs}
										suggestedOverlap={suggestedOverlap[vendor.id]}
										name={<VendorName key={`name-${vendor.id}`} vendor={vendor} />}
										status={
											step == null
												? t('statusReady', { format: vendor.format ?? 'pair' })
												: t('needs', { step: t(step) })
										}
										remove={
											<Button variant="quiet" size="sm" onClick={() => setRemoving(vendor)}>
												<TrashIcon size={ICON_SIZE} />
												{t('remove')}
											</Button>
										}
									/>
								</ReadOnlyFieldset>
							)
						})}
					</section>
					{canAdd ? (
						<ReadOnlyGate action="vendor" isBlock>
							<button
								type="button"
								onClick={add}
								disabled={isAdding}
								className="border-border-strong text-text-muted hover:border-text mt-4 flex w-full flex-col items-center rounded-[16px] border-[1.5px] border-dashed p-7 text-center transition-[border-color] duration-150 disabled:cursor-default"
							>
								<span className="text-text flex items-center gap-2 font-semibold">
									{isAdding ? <SpinnerIcon size={ICON_SIZE} /> : <PlusIcon size={ICON_SIZE} />}
									{isAdding ? t('adding') : t('add')}
								</span>
								{view.isReadOnly ? t('addHintDemo') : t('addHint', { max: maxVendors })}
							</button>
						</ReadOnlyGate>
					) : (
						<p className="border-border-strong text-text-muted mt-4 rounded-[16px] border-[1.5px] border-dashed p-7 text-center">
							{t('maxVendors', { max: maxVendors })}
						</p>
					)}
				</>
			)}
			<p className="text-text-muted mt-4 text-sm">{t('filesNote')}</p>

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

// The vendor's name, as its card's heading: saved when you leave the field.
function VendorName({ vendor }: { vendor: VendorListItem }) {
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
		<div className="min-w-0 flex-1">
			<label htmlFor={id} className="sr-only">
				{t('nameLabel')}
			</label>
			<Input
				id={id}
				className="font-display text-text hover:border-border-input disabled:text-text -ml-2 h-auto min-h-11 w-full truncate border-transparent bg-transparent px-2 py-0.5 text-[1.625rem] leading-tight font-semibold tracking-[-0.025em] disabled:bg-transparent"
				value={name}
				placeholder={t('untitled')}
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
				<p id={`${id}-error`} className="text-danger mt-1 text-sm">
					{error}
				</p>
			)}
		</div>
	)
}

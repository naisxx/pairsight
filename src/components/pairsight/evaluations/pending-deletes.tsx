'use client'

import { createContext, use, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { dismissToast, toast } from '@/lib/toast'
import { deleteEvaluationAction } from '@/server/actions/pairsight/evaluations'

// How long a deleted evaluation can still be brought back.
const UNDO_MS = 10_000

type PendingDeletes = {
	isDeleting: (id: string) => boolean
	remove: (evaluation: { id: string; name: string }) => void
}

const PendingDeletesContext = createContext<PendingDeletes | null>(null)

// Deleting an evaluation, with a way back: confirmed, it leaves the
// dashboard at once (every card and row showing it, HideIfDeleting) and a
// toast offers Undo for UNDO_MS. Only then is it deleted for good. Leaving
// the page carries the delete through, as the toast said it would; if the
// delete fails, the evaluation comes back with the reason.
export function PendingDeletesProvider({ children }: { children: React.ReactNode }) {
	const t = useTranslations('Evaluations')
	const router = useRouter()
	const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
	// Each pending delete's timer and toast, to cancel or carry out early.
	const scheduled = useRef(
		new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string }>()
	)

	const forget = (id: string) =>
		setPending((current) => {
			const next = new Set(current)
			next.delete(id)
			return next
		})

	async function commit(id: string) {
		scheduled.current.delete(id)
		const result = await deleteEvaluationAction({ evaluationId: id })
		if (!result.ok) {
			forget(id)
			toast({ title: result.error, variant: 'destructive' })
			return
		}
		router.refresh()
	}

	function undo(id: string) {
		const entry = scheduled.current.get(id)
		if (entry == null) return
		clearTimeout(entry.timer)
		dismissToast(entry.toastId)
		scheduled.current.delete(id)
		forget(id)
		toast({ title: t('restored') })
	}

	function remove({ id, name }: { id: string; name: string }) {
		setPending((current) => new Set(current).add(id))
		const toastId = toast({
			title: t('deletedName', { name }),
			durationMs: UNDO_MS,
			action: { label: t('undo'), onClick: () => undo(id) }
		})
		const timer = setTimeout(() => void commit(id), UNDO_MS)
		scheduled.current.set(id, { timer, toastId })
	}

	// Leaving with deletes still waiting: they go through now.
	const flush = useEffectEvent(() => {
		scheduled.current.forEach(({ timer, toastId }, id) => {
			clearTimeout(timer)
			dismissToast(toastId)
			void deleteEvaluationAction({ evaluationId: id })
		})
		scheduled.current.clear()
	})
	useEffect(() => () => flush(), [])

	return (
		<PendingDeletesContext value={{ isDeleting: (id) => pending.has(id), remove }}>
			{children}
		</PendingDeletesContext>
	)
}

export function usePendingDeletes(): PendingDeletes {
	const context = use(PendingDeletesContext)
	if (context == null) throw new Error('usePendingDeletes needs a PendingDeletesProvider')
	return context
}

// Whatever shows an evaluation, gone while it's being deleted.
export function HideIfDeleting({ id, children }: { id: string; children: React.ReactNode }) {
	const context = use(PendingDeletesContext)
	return context?.isDeleting(id) === true ? null : children
}

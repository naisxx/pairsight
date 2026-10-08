'use client'

import { createContext, use, useOptimistic, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'
import { ChevronDownIcon, ChevronUpIcon } from '@/components/ui/icons'
import { Sheet } from '@/components/ui/sheet'
import { cn } from '@/lib/cn'

type Row = { id: string; href: string }

type Selection = {
	selectedId: string | null
	isPending: boolean
	select: (id: string) => void
}

const SelectionContext = createContext<Selection | null>(null)

function useSelection(): Selection {
	const selection = use(SelectionContext)
	if (selection == null) throw new Error('useSelection must be used inside <PairSelection>')
	return selection
}

// The pair shown beside the list, and how it changes: picking a row marks it
// at once (optimistically) while the server reads the pair. The server sends
// the panels of the pairs either side too, so stepping to a neighbour (↑/↓,
// or the sheet's arrows) shows it instantly. On a small screen the pair
// opens in a sheet instead of below the whole list.
export function PairSelection({
	selectedId,
	rows,
	panels,
	children
}: {
	// The pair the server rendered beside the list.
	selectedId: string | null
	// This page's rows in order, with the URL that selects each.
	rows: Row[]
	// Panels the server rendered: the selected pair's, and its neighbours'.
	panels: Array<{ id: string; node: React.ReactNode }>
	children: React.ReactNode
}) {
	const t = useTranslations('Results')
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const [shownId, setShownId] = useOptimistic(selectedId)
	const [isSheetOpen, setIsSheetOpen] = useState(false)
	const index = rows.findIndex((row) => row.id === shownId)
	const previous = index > 0 ? rows[index - 1] : undefined
	const next = index >= 0 ? rows[index + 1] : undefined

	function select(id: string) {
		const row = rows.find((candidate) => candidate.id === id)
		if (row == null) return
		// Narrow, the side panel isn't shown: the sheet carries the pair.
		const side = document.querySelector<HTMLElement>('[data-pair-side]')
		if (side != null && side.offsetParent === null) setIsSheetOpen(true)
		startTransition(() => {
			setShownId(id)
			router.replace(row.href, { scroll: false })
		})
	}

	// The panel for the pair being shown: its own when the server has sent
	// it (instantly, for a neighbour), else the last one, dimmed, until it does.
	const shown =
		panels.find((candidate) => candidate.id === shownId) ??
		panels.find((candidate) => candidate.id === selectedId)
	const isWaiting = isPending && shown?.id !== shownId
	const panel =
		shown == null ? null : (
			<div key={shown.id} className="animate-fade-in">
				{shown.node}
			</div>
		)

	return (
		<SelectionContext value={{ selectedId: shownId, isPending, select }}>
			{children}
			{/* Wide: beside the list, kept in view as the list scrolls. */}
			<div
				data-pair-side
				aria-busy={isWaiting}
				className={cn(
					'hidden transition-opacity duration-150 @5xl:sticky @5xl:top-4 @5xl:col-span-5 @5xl:block @5xl:max-h-[calc(100dvh-8rem)] @5xl:overflow-y-auto @5xl:rounded-lg',
					isWaiting && 'opacity-60'
				)}
			>
				{panel}
			</div>
			{/* Narrow: a sheet over the list, with the pairs either side a tap away. */}
			<Sheet
				open={isSheetOpen}
				onOpenChange={setIsSheetOpen}
				title={t('panelLabel')}
				closeLabel={t('sheetClose')}
				actions={
					<>
						<button
							type="button"
							disabled={previous == null}
							onClick={() => previous != null && select(previous.id)}
							aria-label={t('previousPair')}
							className="text-text hover:bg-surface-hover flex size-11 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40"
						>
							<ChevronUpIcon />
						</button>
						<button
							type="button"
							disabled={next == null}
							onClick={() => next != null && select(next.id)}
							aria-label={t('nextPair')}
							className="text-text hover:bg-surface-hover flex size-11 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40"
						>
							<ChevronDownIcon />
						</button>
					</>
				}
			>
				<div aria-busy={isWaiting} className={cn('transition-opacity', isWaiting && 'opacity-60')}>
					{panel}
				</div>
			</Sheet>
		</SelectionContext>
	)
}

// A row's link: selects its pair on the spot (and still a real link, so it
// opens in a new tab like any other). The row is styled from it
// (`data-selected`), so the highlight moves the moment it's picked.
export function RowLink({
	pairId,
	href,
	fullHref,
	label,
	children
}: {
	pairId: string
	href: string
	// The pair's own page, for Enter on the selected row (results-keyboard.tsx).
	fullHref: string
	label: string
	children: React.ReactNode
}) {
	const { selectedId, select } = useSelection()
	const isSelected = pairId === selectedId
	return (
		<Link
			href={href}
			scroll={false}
			replace
			prefetch={false}
			aria-current={isSelected ? 'true' : undefined}
			aria-label={label}
			aria-keyshortcuts="Enter ArrowUp ArrowDown"
			data-selected={isSelected}
			data-full-href={fullHref}
			onClick={(event) => {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
				event.preventDefault()
				select(pairId)
			}}
			className="after:absolute after:inset-0"
		>
			{children}
		</Link>
	)
}

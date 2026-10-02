'use client'

import { useTranslations } from 'next-intl'
import { Dialog } from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/segmented'
import { SuccessIcon, WaitingIcon } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/skeleton'
import type { RunCard as RunCardData } from '@/server/pairsight/run-centre'
import { RunCard } from './run-card'
import type { RunsTab } from './runs-centre'

const SKELETON_CARDS = 2
const EMPTY_ICON_SIZE = 22

// A tab with nothing in it: what belongs there, and how it gets there.
function EmptyTab({ tab }: { tab: RunsTab }) {
	const t = useTranslations('Runs')
	const Icon = tab === 'active' ? WaitingIcon : SuccessIcon
	return (
		<div className="rise flex flex-col items-center px-6 py-10 text-center">
			<span className="bg-surface-muted text-text-muted flex size-12 items-center justify-center rounded-full">
				<Icon size={EMPTY_ICON_SIZE} />
			</span>
			<p className="mt-3 text-sm font-semibold">
				{tab === 'active' ? t('emptyActiveTitle') : t('emptyCompletedTitle')}
			</p>
			<p className="type-ui text-text-muted mt-1 max-w-sm">
				{tab === 'active' ? t('emptyActive') : t('emptyCompleted')}
			</p>
		</div>
	)
}

// The Runs centre's dialog: Active (runs still going, live) and Completed
// (finished, finished with failures, or stopped), newest first.
export function RunsDialog({
	open,
	onOpenChange,
	tab,
	onTabChange,
	cards,
	isLoading,
	hasError,
	focusRunId,
	activeIds
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	tab: RunsTab
	onTabChange: (tab: RunsTab) => void
	cards: RunCardData[] | null
	isLoading: boolean
	hasError: boolean
	focusRunId: string | null
	activeIds: ReadonlySet<string>
}) {
	const t = useTranslations('Runs')
	const isActive = (card: RunCardData) => card.status === 'running' || activeIds.has(card.id)
	const active = cards?.filter(isActive) ?? []
	const completed = cards?.filter((card) => !isActive(card)) ?? []
	const shown = tab === 'active' ? active : completed

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('title')}
			description={t('description')}
			closeLabel={t('close')}
			width="xl"
		>
			<Segmented<RunsTab>
				label={t('tabsLabel')}
				value={tab}
				onChange={onTabChange}
				options={[
					{ value: 'active', label: t('tabActive', { count: active.length }) },
					{ value: 'completed', label: t('tabCompleted', { count: completed.length }) }
				]}
			/>
			{/* Keyed by tab, so switching tabs plays the cards in again. */}
			<div key={tab} className="rise-gentle mt-4 min-h-64 space-y-3 pb-2">
				{hasError ? (
					<p role="alert" className="text-danger type-ui">
						{t('loadError')}
					</p>
				) : isLoading && cards == null ? (
					Array.from({ length: SKELETON_CARDS }, (_, index) => (
						<Skeleton key={index} className="h-28 w-full rounded-md" />
					))
				) : shown.length === 0 ? (
					<EmptyTab tab={tab} />
				) : (
					shown.map((card, index) => (
						<div key={card.id} className={`rise stagger-${index}`}>
							<RunCard card={card} isFocused={card.id === focusRunId} />
						</div>
					))
				)}
			</div>
		</Dialog>
	)
}

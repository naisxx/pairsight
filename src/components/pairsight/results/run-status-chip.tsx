import { useTranslations } from 'next-intl'
import { AlertIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// The run's stored status, exactly as the backend has it — never an
// optimistic "done" (docs/PairSight-UX-Plan.md §1).
export function RunStatusChip({ status }: { status: 'running' | 'completed' | 'stopped' }) {
	const t = useTranslations('Results')
	return (
		<span
			className={cn(
				'type-meta inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium whitespace-nowrap',
				status === 'completed' && 'bg-success-subtle text-success',
				status === 'running' && 'bg-surface-muted text-text-muted',
				status === 'stopped' && 'bg-warning-subtle text-warning'
			)}
		>
			{status === 'completed' ? (
				<SuccessIcon size={12} />
			) : status === 'running' ? (
				<SpinnerIcon size={12} />
			) : (
				<AlertIcon size={12} />
			)}
			{t(`runStatus.${status}`)}
		</span>
	)
}

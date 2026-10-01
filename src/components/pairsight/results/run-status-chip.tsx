import { useTranslations } from 'next-intl'
import { Chip } from '@/components/ui/chip'
import { AlertIcon, SpinnerIcon, SuccessIcon } from '@/components/ui/icons'

const ICON_SIZE = 13

// The run's stored status, exactly as the backend has it — never an
// optimistic "done" (docs/PairSight-UX-Plan.md §1).
export function RunStatusChip({ status }: { status: 'running' | 'completed' | 'stopped' }) {
	const t = useTranslations('Results')
	if (status === 'completed') {
		return (
			<Chip tone="success" icon={<SuccessIcon size={ICON_SIZE} variant="solid" />}>
				{t('runStatus.completed')}
			</Chip>
		)
	}
	if (status === 'running') {
		return (
			<Chip tone="info" icon={<SpinnerIcon size={ICON_SIZE} />}>
				{t('runStatus.running')}
			</Chip>
		)
	}
	return (
		<Chip tone="warning" icon={<AlertIcon size={ICON_SIZE} />}>
			{t('runStatus.stopped')}
		</Chip>
	)
}

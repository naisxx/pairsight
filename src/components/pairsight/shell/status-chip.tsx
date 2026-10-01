import { useTranslations } from 'next-intl'
import { Chip, type ChipTone } from '@/components/ui/chip'
import type { EvaluationStatus } from '@/lib/pairsight/stages'

const STATUS_TONE: Record<EvaluationStatus, ChipTone> = {
	draft: 'neutral',
	readyToRun: 'info',
	running: 'info',
	needsAttention: 'danger',
	complete: 'success'
}

// The evaluation's overall state, in the top bar and on the dashboard.
export function EvaluationStatusChip({ status }: { status: EvaluationStatus }) {
	const t = useTranslations('Pipeline')
	return <Chip tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Chip>
}

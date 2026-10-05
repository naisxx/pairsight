'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { PlayIcon } from '@/components/ui/icons'
import { useRunsCentre } from '../runs/runs-centre'

const ICON_SIZE = 15

// Opens the Runs centre on one run, where it can be followed, paused or
// resumed.
export function OpenRunsButton({ runId }: { runId: string }) {
	const t = useTranslations('Results')
	const { open } = useRunsCentre()
	return (
		<Button size="sm" onClick={() => open({ focusRunId: runId })}>
			<PlayIcon size={ICON_SIZE} />
			{t('notFinishedOpenRuns')}
		</Button>
	)
}

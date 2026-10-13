'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { useRunsCentre } from '../runs/runs-centre'

// Opens the Runs centre on one run, where it can be followed, paused or
// resumed.
export function OpenRunsButton({ runId }: { runId: string }) {
	const t = useTranslations('Results')
	const { open } = useRunsCentre()
	return (
		<Button cap={<ArrowRightIcon />} onClick={() => open({ focusRunId: runId })}>
			{t('notFinishedOpenRuns')}
		</Button>
	)
}

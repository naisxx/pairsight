'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { AlertIcon, RetryIcon, SpinnerIcon } from '@/components/ui/icons'
import { retryPairAction } from '@/server/actions/pairsight/runs'

// Asks Jev about this one failed pair again, then shows whatever the backend
// now holds: a score, or the failure if it failed again.
export function RetryPairButton({ runId, pairId }: { runId: string; pairId: string }) {
	const t = useTranslations('Pair')
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)
	const [isPending, startTransition] = useTransition()
	return (
		<div className="flex flex-col items-start gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={isPending}
				onClick={() =>
					startTransition(async () => {
						setError(null)
						const result = await retryPairAction({ runId, pairId })
						if (!result.ok) setError(result.error)
						else if (result.data.status === 'failed') setError(t('retryError'))
						router.refresh()
					})
				}
			>
				{isPending ? <SpinnerIcon /> : <RetryIcon />}
				{isPending ? t('retrying') : t('retry')}
			</Button>
			{error != null && (
				<p role="alert" className="text-danger type-meta flex items-center gap-1.5">
					<AlertIcon />
					{error}
				</p>
			)}
		</div>
	)
}

'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon } from '@/components/ui/icons'
import { toast } from '@/lib/toast'
import { retrySuggestionsAction } from '@/server/actions/pairsight/rules'

const SPINNER_SIZE = 13

// Asks PairSight to work out the pairs to check again, after it couldn't;
// the plan then waits for them and refreshes itself.
export function RetrySuggestionsButton({ evaluationId }: { evaluationId: string }) {
	const t = useTranslations('Plan')
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	return (
		<Button
			variant="secondary"
			size="sm"
			className="h-7"
			disabled={isPending}
			onClick={() =>
				startTransition(async () => {
					const result = await retrySuggestionsAction({ evaluationId })
					if (!result.ok) {
						toast({ title: result.error, variant: 'destructive' })
						return
					}
					router.refresh()
				})
			}
		>
			{isPending && <SpinnerIcon size={SPINNER_SIZE} />}
			{t('retrySuggestions')}
		</Button>
	)
}

'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon } from '@/components/ui/icons'
import { toast } from '@/lib/toast'
import { turnOffRuleAction } from '@/server/actions/pairsight/rules'

const SPINNER_SIZE = 13

// Switches one rule off from the over-limit list, then recounts the plan.
export function TurnOffRuleButton({
	evaluationId,
	ruleId,
	label
}: {
	evaluationId: string
	ruleId: string
	label: string
}) {
	const t = useTranslations('Plan')
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	return (
		<Button
			variant="secondary"
			size="sm"
			className="ml-auto h-7"
			disabled={isPending}
			aria-label={t('turnOffLabel', { rule: label })}
			onClick={() =>
				startTransition(async () => {
					const result = await turnOffRuleAction({ evaluationId, ruleId })
					if (!result.ok) {
						toast({ title: result.error, variant: 'destructive' })
						return
					}
					toast({ title: t('turnedOff', { rule: label }) })
					router.refresh()
				})
			}
		>
			{isPending && <SpinnerIcon size={SPINNER_SIZE} />}
			{t('turnOff')}
		</Button>
	)
}

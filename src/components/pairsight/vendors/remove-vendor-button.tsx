'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon, TrashIcon } from '@/components/ui/icons'
import { toast } from '@/lib/toast'
import { deleteVendorAction } from '@/server/actions/pairsight/vendors'

export function RemoveVendorButton({ exportId, name }: { exportId: string; name: string }) {
	const t = useTranslations('Vendors')
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	return (
		<Button
			variant="ghost"
			size="sm"
			aria-label={t('remove', { name })}
			disabled={isPending}
			onClick={() =>
				startTransition(async () => {
					const result = await deleteVendorAction({ exportId })
					if (!result.ok) toast({ title: result.error, variant: 'destructive' })
					router.refresh()
				})
			}
		>
			{isPending ? <SpinnerIcon /> : <TrashIcon />}
		</Button>
	)
}

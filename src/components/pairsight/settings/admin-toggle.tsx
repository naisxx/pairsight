'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { SpinnerIcon } from '@/components/ui/icons'
import { toast } from '@/lib/toast'
import { setAdminAction } from '@/server/actions/pairsight/settings'

const ICON_SIZE = 14

// Make someone an admin, or stop them being one. The server refuses removing
// yourself or the last admin, and says why.
export function AdminToggle({
	userId,
	name,
	isAdmin
}: {
	userId: string
	name: string
	isAdmin: boolean
}) {
	const t = useTranslations('Settings')
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const [error, setError] = useState<string | null>(null)

	return (
		<div className="flex flex-col items-end gap-1">
			<Button
				variant="secondary"
				size="sm"
				disabled={isPending}
				aria-label={isAdmin ? t('removeAdminOf', { name }) : t('makeAdminOf', { name })}
				onClick={() =>
					startTransition(async () => {
						setError(null)
						const result = await setAdminAction({ userId, isAdmin: !isAdmin })
						if (!result.ok) {
							setError(result.error)
							return
						}
						toast({
							title: isAdmin ? t('removedAdminToast', { name }) : t('madeAdminToast', { name })
						})
						router.refresh()
					})
				}
			>
				{isPending && <SpinnerIcon size={ICON_SIZE} />}
				{isAdmin ? t('removeAdmin') : t('makeAdmin')}
			</Button>
			{error != null && (
				<p role="alert" className="text-danger max-w-[260px] text-right text-sm">
					{error}
				</p>
			)}
		</div>
	)
}

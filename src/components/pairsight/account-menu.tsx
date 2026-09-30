'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SignOutIcon, UserIcon } from '@/components/ui/icons'
import { signOut } from '@/server/actions/auth'

export function AccountMenu({ email }: { email: string }) {
	const t = useTranslations('Shell')
	const [isPending, startTransition] = useTransition()
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					aria-label={t('account')}
					className="w-9 bg-transparent px-0"
				>
					<UserIcon size={18} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="text-text-muted type-meta truncate">
					{email}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={isPending}
					onSelect={() => startTransition(async () => void (await signOut({})))}
				>
					<SignOutIcon />
					{t('signOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

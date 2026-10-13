'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SignOutIcon } from '@/components/ui/icons'
import { initialsOf } from '@/lib/auth/profile'
import { signOut } from '@/server/actions/auth'

const ICON_SIZE = 15

// The signed-in person, at the end of the top bar: their initials, and a
// menu with who they're signed in as and Sign out.
export function AccountMenu({ email, name }: { email: string; name: string }) {
	const t = useTranslations('Shell')
	const [isPending, startTransition] = useTransition()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={t('accountOf', { name })}
				className="border-border hover:border-border-strong inline-flex size-11 shrink-0 items-center justify-center rounded-md border transition-[border-color] duration-150"
			>
				<span className="bg-surface-muted text-text flex size-8 items-center justify-center rounded-sm font-mono text-xs font-semibold">
					{initialsOf(name)}
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[240px]">
				<DropdownMenuLabel>
					<span className="text-text block truncate font-semibold">{name}</span>
					<span className="text-text-muted block truncate font-normal">{email}</span>
				</DropdownMenuLabel>
				<DropdownMenuItem
					disabled={isPending}
					onSelect={() => startTransition(async () => void (await signOut({})))}
				>
					<SignOutIcon size={ICON_SIZE} />
					{t('signOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

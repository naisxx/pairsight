'use client'

import { useTransition } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
	ChevronsUpDownIcon,
	MonitorIcon,
	MoonIcon,
	SignOutIcon,
	SunIcon
} from '@/components/ui/icons'
import { signOut } from '@/server/actions/auth'
import { SidebarTip } from './sidebar-tip'

const THEMES = ['light', 'dark', 'system'] as const

// Rows share the nav items' geometry, so their icons sit on the collapsed
// sidebar's centre line.
const ROW =
	'hover:bg-surface-hover focus-visible:outline-ring flex h-9 w-full items-center gap-3 overflow-hidden rounded px-4 text-left whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2'

export function SidebarThemeMenu() {
	const t = useTranslations('Theme')
	const { theme, setTheme } = useTheme()
	return (
		<DropdownMenu>
			<SidebarTip label={t('label')}>
				<DropdownMenuTrigger className={`${ROW} text-text-muted hover:text-text type-label`}>
					{/* Both glyphs render and CSS picks, so server and client agree before next-themes knows the preference. */}
					<SunIcon className="shrink-0 dark:hidden" />
					<MoonIcon className="hidden shrink-0 dark:block" />
					<span className="shell-fade">{t('label')}</span>
				</DropdownMenuTrigger>
			</SidebarTip>
			<DropdownMenuContent side="right" align="end" className="w-40">
				<DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
					{THEMES.map((value) => (
						<DropdownMenuRadioItem key={value} value={value} className="gap-2">
							{value === 'light' ? <SunIcon /> : value === 'dark' ? <MoonIcon /> : <MonitorIcon />}
							{t(value)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function SidebarAccountMenu({ email }: { email: string }) {
	const t = useTranslations('Shell')
	const [isPending, startTransition] = useTransition()
	const initials = email.slice(0, 2).toUpperCase()
	return (
		<DropdownMenu>
			<SidebarTip label={email}>
				<DropdownMenuTrigger
					aria-label={t('account')}
					className="hover:bg-surface-hover focus-visible:outline-ring flex w-full items-center gap-2.5 overflow-hidden rounded py-2 pr-2 pl-2.5 text-left whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
				>
					<span className="bg-selected text-text grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
						{initials}
					</span>
					<span className="shell-fade flex min-w-0 flex-1 flex-col">
						<span className="text-text type-label">{t('account')}</span>
						<span className="text-text-muted type-meta truncate">{email}</span>
					</span>
					<ChevronsUpDownIcon size={14} className="shell-fade text-text-muted shrink-0" />
				</DropdownMenuTrigger>
			</SidebarTip>
			<DropdownMenuContent side="right" align="end" className="w-56">
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

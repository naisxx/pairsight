'use client'

import { useSyncExternalStore, useTransition } from 'react'
import { useTheme } from 'next-themes'
import { UI_STYLES } from '@/lib/ui-style'
import { useUiStyle } from '../use-ui-style'
import { useTranslations } from 'next-intl'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
	CheckIcon,
	MonitorIcon,
	MoonIcon,
	SignInIcon,
	SignOutIcon,
	SunIcon
} from '@/components/ui/icons'
import { Tip } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import { initialsOf } from '@/lib/auth/profile'
import { cn } from '@/lib/cn'
import { signOut } from '@/server/actions/auth'
import { useSidebarMode } from './shell-frame'

const ICON_SIZE = 15
const THEMES = ['light', 'dark', 'system'] as const
type ThemeChoice = (typeof THEMES)[number]

const THEME_ICONS: Record<ThemeChoice, React.ComponentType<{ size?: number }>> = {
	light: SunIcon,
	dark: MoonIcon,
	system: MonitorIcon
}

function isThemeChoice(value: string | undefined): value is ThemeChoice {
	return THEMES.some((theme) => theme === value)
}

const noSubscription = () => () => {}

// next-themes only knows the saved choice in the browser, so the server and
// the first client render show none; it appears once hydrated.
function useIsHydrated(): boolean {
	return useSyncExternalStore(
		noSubscription,
		() => true,
		() => false
	)
}

export function SidebarThemeMenu() {
	const t = useTranslations('Theme')
	const { theme, setTheme } = useTheme()
	const [style, setStyle] = useUiStyle()
	const { isCollapsed } = useSidebarMode()
	const isHydrated = useIsHydrated()
	const current: ThemeChoice = isHydrated && isThemeChoice(theme) ? theme : 'system'
	const CurrentIcon = THEME_ICONS[current]

	const trigger = (
		<DropdownMenuTrigger
			aria-label={t('change', { current: t(current) })}
			className={cn(
				'type-ui text-text-muted hover:bg-surface-hover hover:text-text flex h-8 items-center gap-2 rounded-sm transition-colors duration-150',
				isCollapsed ? 'w-8 justify-center' : 'w-full px-2'
			)}
		>
			<CurrentIcon size={ICON_SIZE} />
			{!isCollapsed && (
				<>
					<span>{t('label')}</span>
					<span className="ml-auto text-xs">{isHydrated ? t(current) : null}</span>
				</>
			)}
		</DropdownMenuTrigger>
	)

	return (
		<DropdownMenu>
			{isCollapsed ? (
				<Tip content={t('label')} side="right">
					{trigger}
				</Tip>
			) : (
				trigger
			)}
			<DropdownMenuContent align="start" side="top">
				<DropdownMenuLabel>{t('appearance')}</DropdownMenuLabel>
				{THEMES.map((value) => {
					const Icon = THEME_ICONS[value]
					return (
						<DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
							<span className="text-text-muted">
								<Icon size={ICON_SIZE} />
							</span>
							{t(value)}
							{current === value && <CheckIcon size={14} className="text-accent-ink ml-auto" />}
						</DropdownMenuItem>
					)
				})}
				<DropdownMenuSeparator />
				<DropdownMenuLabel>{t('style')}</DropdownMenuLabel>
				{UI_STYLES.map((value) => (
					<DropdownMenuItem key={value} onSelect={() => setStyle(value)}>
						{t(value)}
						{style === value && <CheckIcon size={14} className="text-accent-ink ml-auto" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function SidebarAccountMenu({ email, name }: { email: string; name: string }) {
	const t = useTranslations('Shell')
	const { isCollapsed } = useSidebarMode()
	const [isPending, startTransition] = useTransition()
	const initials = initialsOf(name)

	const trigger = (
		<DropdownMenuTrigger
			aria-label={t('accountOf', { name })}
			className={cn(
				'hover:bg-surface-hover flex items-center gap-2 rounded-sm text-left transition-colors duration-150',
				isCollapsed ? 'size-9 justify-center' : 'h-11 w-full px-2'
			)}
		>
			<span className="bg-surface-muted text-text flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
				{initials}
			</span>
			{!isCollapsed && (
				<span className="min-w-0">
					<span className="text-text type-ui block truncate font-medium">{name}</span>
					<span className="text-text-muted type-caption block truncate">{email}</span>
				</span>
			)}
		</DropdownMenuTrigger>
	)

	return (
		<DropdownMenu>
			{isCollapsed ? (
				<Tip content={email} side="right">
					{trigger}
				</Tip>
			) : (
				trigger
			)}
			<DropdownMenuContent align="start" side="top" className="w-[220px]">
				<DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
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

// In the sandbox, for someone who isn't signed in: the way in, where the
// account menu would be.
export function SidebarSignIn() {
	const t = useTranslations('Shell')
	const { isCollapsed } = useSidebarMode()
	if (isCollapsed) {
		return (
			<Tip content={t('signIn')} side="right">
				<Button variant="quiet" size="icon" asChild>
					<Link href="/sign-in" aria-label={t('signIn')}>
						<SignInIcon size={ICON_SIZE} />
					</Link>
				</Button>
			</Tip>
		)
	}
	return (
		<div className="flex flex-col gap-1.5 px-0.5 py-1">
			<Button size="sm" asChild>
				<Link href="/sign-up">{t('signUp')}</Link>
			</Button>
			<Button variant="quiet" size="sm" asChild>
				<Link href="/sign-in">{t('signIn')}</Link>
			</Button>
		</div>
	)
}

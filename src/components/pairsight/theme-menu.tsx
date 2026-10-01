'use client'

import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MonitorIcon, MoonIcon, SunIcon } from '@/components/ui/icons'

const THEMES = ['light', 'dark', 'system'] as const

// The trigger shows both glyphs and lets CSS pick, so the server render and
// the first client render agree before next-themes knows the preference.
export function ThemeMenu() {
	const t = useTranslations('Theme')
	const { theme, setTheme } = useTheme()
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					aria-label={t('label')}
					className="w-9 bg-transparent px-0"
				>
					<SunIcon size={18} className="dark:hidden" />
					<MoonIcon size={18} className="hidden dark:block" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40">
				<DropdownMenuLabel className="text-text-muted type-meta">{t('label')}</DropdownMenuLabel>
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

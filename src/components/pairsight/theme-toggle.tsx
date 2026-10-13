'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { ThemeIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

const ICON_SIZE = 18
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const noSubscription = () => () => {}

// next-themes only knows the theme in the browser, so the server and the
// first client render say nothing about it; it appears once hydrated.
function useIsHydrated(): boolean {
	return useSyncExternalStore(
		noSubscription,
		() => true,
		() => false
	)
}

// Light or dark, one button (the design's round switch). The choice is
// saved and wins everywhere from then on; until someone makes one, the page
// follows the system setting (the landing page starts dark). The page
// cross-fades where the browser can (a view transition, globals.css); the
// attribute is set inside the transition so the new state is what it
// captures, rather than waiting for next-themes' effect.
export function ThemeToggle({ className }: { className?: string }) {
	const t = useTranslations('Theme')
	const { resolvedTheme, setTheme } = useTheme()
	const isHydrated = useIsHydrated()
	const isDark = resolvedTheme === 'dark'

	function toggle() {
		const next = isDark ? 'light' : 'dark'
		const apply = () => {
			document.documentElement.setAttribute('data-theme', next)
			document.documentElement.style.colorScheme = next
			setTheme(next)
		}
		if ('startViewTransition' in document && !window.matchMedia(REDUCED_MOTION).matches) {
			document.startViewTransition(apply)
		} else {
			apply()
		}
	}

	return (
		<button
			type="button"
			aria-label={t('toggle')}
			aria-pressed={isHydrated ? isDark : undefined}
			onClick={toggle}
			className={cn(
				'border-border text-text hover:border-border-strong inline-flex size-11 shrink-0 items-center justify-center rounded-md border transition-[border-color] duration-150',
				className
			)}
		>
			<ThemeIcon size={ICON_SIZE} variant="solid" />
		</button>
	)
}

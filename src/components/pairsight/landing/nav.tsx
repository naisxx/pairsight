'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { m, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { ThemeMenu } from '../theme-menu'
import { Wordmark } from '../wordmark'
import { LANDING_SECTIONS } from './sections'

// A section counts as current once its top passes this share of the viewport.
const ACTIVE_LINE = 0.4
const PROGRESS_SPRING = { stiffness: 220, damping: 40, restDelta: 0.001 }

// The landing's floating pill: the wordmark, a link to each section (the
// current one marked), the theme menu, Sign in and the demo, with a thin bar
// along the top showing how far down the page you are.
export function LandingNav() {
	const t = useTranslations('HomePage')
	const { scrollY, scrollYProgress } = useScroll()
	const progress = useSpring(scrollYProgress, PROGRESS_SPRING)
	const [active, setActive] = useState<string | null>(null)

	useMotionValueEvent(scrollY, 'change', () => {
		const line = window.innerHeight * ACTIVE_LINE
		let current: string | null = null
		for (const section of LANDING_SECTIONS) {
			const top = document.getElementById(section.id)?.getBoundingClientRect().top
			if (top != null && top < line) current = section.id
		}
		setActive(current)
	})

	return (
		<>
			<m.div
				aria-hidden
				className="bg-action fixed inset-x-0 top-0 z-50 h-0.5 origin-left"
				style={{ scaleX: progress }}
			/>
			<header className="fixed inset-x-0 top-3 z-40 px-3 md:top-4 md:px-5">
				<div className="border-border bg-surface/80 mx-auto flex h-14 max-w-[1160px] items-center gap-2 rounded-full border pr-2 pl-4 shadow-[0_8px_30px_-12px_rgb(15_23_32/0.25)] backdrop-blur-md md:pl-5">
					<Link href="/" aria-label={t('home')} className="shrink-0 rounded-sm">
						<Wordmark labelClassName="max-[380px]:sr-only" />
					</Link>
					<nav aria-label={t('sectionsNav')} className="mx-auto hidden min-[900px]:block">
						<ul className="flex items-center gap-0.5">
							{LANDING_SECTIONS.map((section) => (
								<li key={section.id}>
									<a
										href={`#${section.id}`}
										aria-current={active === section.id ? 'true' : undefined}
										className={cn(
											'type-ui rounded-full px-3 py-1.5 whitespace-nowrap transition-colors duration-150',
											active === section.id
												? 'bg-surface-muted text-text'
												: 'text-text-muted hover:text-text'
										)}
									>
										{t(section.label)}
									</a>
								</li>
							))}
						</ul>
					</nav>
					<nav
						aria-label={t('accountNav')}
						className="ml-auto flex shrink-0 items-center gap-1 min-[900px]:ml-0"
					>
						<ThemeMenu />
						<Button variant="quiet" size="sm" asChild>
							<Link href="/sign-in">{t('signIn')}</Link>
						</Button>
						<Button size="sm" className="rounded-full" asChild>
							<Link href="/sandbox">{t('explore')}</Link>
						</Button>
					</nav>
				</div>
			</header>
		</>
	)
}

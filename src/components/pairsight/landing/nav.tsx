import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '../theme-toggle'
import { Wordmark } from '../wordmark'
import { WRAP } from './parts'
import { LANDING_SECTIONS } from './sections'

// A quiet text link in the bar, lit on hover.
export const NAV_LINK =
	'landing-press text-text-body hover:bg-surface-muted hover:text-text inline-flex min-h-11 items-center rounded-[10px] px-3.5 transition-[background-color,color] duration-150'

// The landing's top bar (pairsight-handoff Landing): the mark, a link to
// each section, the theme switch, Sign in and the demo.
export async function LandingNav() {
	const t = await getTranslations('HomePage')
	return (
		<header className="bg-bg relative z-[2]">
			<div
				className={cn(
					WRAP,
					'border-border flex min-h-[76px] flex-wrap items-center gap-x-4 gap-y-2 border-b max-[599px]:min-h-16 max-[599px]:gap-x-2'
				)}
			>
				<Link
					href="/"
					aria-label={t('home')}
					className="landing-press inline-flex min-h-11 items-center rounded-sm hover:opacity-80 max-[599px]:flex-1"
				>
					<Wordmark labelClassName="text-2xl max-[599px]:text-xl" />
				</Link>
				<nav
					aria-label={t('sectionsNav')}
					className="hidden flex-auto justify-center gap-0.5 min-[900px]:flex"
				>
					{LANDING_SECTIONS.map((section) => (
						<a key={section.id} href={`#${section.id}`} className={NAV_LINK}>
							{t(section.label)}
						</a>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-x-4 max-[599px]:gap-x-2 min-[900px]:ml-0">
					<ThemeToggle className="landing-press landing-theme" />
					<Link href="/sign-in" className={cn(NAV_LINK, 'max-[599px]:hidden')}>
						{t('signIn')}
					</Link>
					<Button
						asChild
						size="lg"
						className="landing-cta h-[46px] max-[599px]:h-11 max-[599px]:rounded-[12px] max-[599px]:px-3.5"
					>
						<Link href="/sandbox">
							<span className="max-[599px]:hidden">{t('openDemo')}</span>
							<span className="min-[600px]:hidden">{t('openDemoShort')}</span>
						</Link>
					</Button>
				</div>
			</div>
		</header>
	)
}

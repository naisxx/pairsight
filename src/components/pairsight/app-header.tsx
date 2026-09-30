import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { getSessionUser } from '@/server/auth/session'
import { AccountMenu } from './account-menu'
import { ThemeMenu } from './theme-menu'
import { Wordmark } from './wordmark'

export async function AppHeader() {
	const [t, user] = await Promise.all([getTranslations('Shell'), getSessionUser()])
	return (
		<header className="border-border bg-surface/80 sticky top-0 z-40 border-b backdrop-blur">
			<a
				href="#main"
				className="bg-action text-action-ink sr-only rounded px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
			>
				{t('skipToContent')}
			</a>
			<div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
				<Link
					href="/"
					className="focus-visible:outline-ring rounded focus-visible:outline-2 focus-visible:outline-offset-4"
				>
					<Wordmark />
				</Link>
				<nav aria-label={t('mainNavigation')} className="flex items-center gap-1">
					{user != null && (
						<Link
							href="/evaluations"
							className="text-text-muted hover:text-text hover:bg-surface-hover rounded px-2 py-1.5 text-sm font-medium transition-colors"
						>
							{t('evaluations')}
						</Link>
					)}
				</nav>
				<div className="ml-auto flex items-center gap-1">
					<ThemeMenu />
					{user != null ? (
						<AccountMenu email={user.email} />
					) : (
						<Button asChild variant="outline" size="sm">
							<Link href="/sign-in">{t('signIn')}</Link>
						</Button>
					)}
				</div>
			</div>
		</header>
	)
}

import { getLocale, getTranslations } from 'next-intl/server'
import { Link, redirect } from '@/i18n/routing'
import { Wordmark } from '@/components/pairsight/wordmark'
import { WelcomeForm } from '@/components/pairsight/welcome-form'
import { safeNext } from '@/lib/auth/safe-next'
import { getProfileName, getSessionUser } from '@/server/auth/session'

// Onboarding: the one thing we ask before the app opens, the person's full
// name. Every app page sends a signed-in account without one here
// (requireUserOrRedirect), and this page sends them on once it's saved.
export default async function WelcomePage({
	searchParams
}: {
	searchParams: Promise<{ next?: string }>
}) {
	const [{ next }, user, locale, t] = await Promise.all([
		searchParams,
		getSessionUser(),
		getLocale(),
		getTranslations('Welcome')
	])
	if (user == null) {
		return redirect({ href: { pathname: '/sign-in', query: { next: '/welcome' } }, locale })
	}
	if ((await getProfileName(user.id)) != null) {
		return redirect({ href: safeNext(next), locale })
	}

	return (
		<div className="bg-bg text-text flex min-h-dvh flex-col">
			<header className="flex h-16 items-center px-5 md:px-8">
				<Link href="/evaluations" aria-label={t('home')} className="rounded-sm">
					<Wordmark />
				</Link>
			</header>
			<main id="main" className="flex flex-1 items-start justify-center px-5 pt-8 pb-16 md:pt-16">
				<div className="w-full max-w-[400px]">
					<h1 className="text-2xl font-semibold tracking-[-0.01em]">{t('title')}</h1>
					<p className="text-text-muted mt-1.5 text-sm">{t('description')}</p>
					<WelcomeForm next={next} />
					<p className="text-text-muted type-ui mt-5 text-center">
						{t('signedInAs', { email: user.email })}
					</p>
				</div>
			</main>
		</div>
	)
}

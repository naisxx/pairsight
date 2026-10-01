import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { AuthShell } from '@/components/pairsight/auth-shell'
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
		<AuthShell title={t('title')} description={t('description')} homeHref="/evaluations">
			<WelcomeForm next={next} />
			<p className="text-text-muted type-ui mt-5 text-center">
				{t('signedInAs', { email: user.email })}
			</p>
		</AuthShell>
	)
}

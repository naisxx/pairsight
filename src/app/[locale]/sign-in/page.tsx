import { getTranslations } from 'next-intl/server'
import { AuthForm } from '@/components/pairsight/auth-form'
import { AuthShell } from '@/components/pairsight/auth-shell'
import { redirectIfSignedIn } from '@/server/auth/session'

export default async function SignInPage({
	searchParams
}: {
	searchParams: Promise<{ next?: string }>
}) {
	const [{ next }, t] = await Promise.all([searchParams, getTranslations('Auth')])
	await redirectIfSignedIn(next)
	return (
		<AuthShell title={t('signInTitle')} description={t('signInDescription')}>
			<AuthForm mode="sign-in" next={next} />
		</AuthShell>
	)
}

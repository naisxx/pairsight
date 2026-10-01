import { getTranslations } from 'next-intl/server'
import { AuthForm } from '@/components/pairsight/auth-form'
import { AuthShell } from '@/components/pairsight/auth-shell'
import { redirectIfSignedIn } from '@/server/auth/session'

export default async function SignUpPage({
	searchParams
}: {
	searchParams: Promise<{ next?: string }>
}) {
	const [{ next }, t] = await Promise.all([searchParams, getTranslations('Auth')])
	await redirectIfSignedIn(next)
	return (
		<AuthShell title={t('signUpTitle')} description={t('signUpDescription')}>
			<AuthForm mode="sign-up" next={next} />
		</AuthShell>
	)
}

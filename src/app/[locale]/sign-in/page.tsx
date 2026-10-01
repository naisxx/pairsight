import { getTranslations } from 'next-intl/server'
import { AppHeader } from '@/components/pairsight/app-header'
import { AuthForm } from '@/components/pairsight/auth-form'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

export default async function SignInPage({
	searchParams
}: {
	searchParams: Promise<{ next?: string }>
}) {
	const [{ next }, t] = await Promise.all([searchParams, getTranslations('Auth')])
	return (
		<>
			<AppHeader />
			<main
				id="main"
				className="flex min-h-[calc(100dvh-3.5rem)] items-start justify-center px-4 pt-16 sm:pt-24"
			>
				<Card className="w-full max-w-sm">
					<CardHeader>
						<h1 className="text-text type-heading">{t('signInTitle')}</h1>
						<CardDescription>{t('signInDescription')}</CardDescription>
					</CardHeader>
					<CardContent>
						<AuthForm mode="sign-in" next={next} />
					</CardContent>
				</Card>
			</main>
		</>
	)
}

import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ErrorPage, errorPageActionClassName } from '@/components/error-page'
import { getSessionUser } from '@/server/auth/session'
import { LostScene } from '@/components/pairsight/empty/scenes'

// Signed in, the way back is your evaluations; "/" is the signed-out landing.
export default async function NotFound() {
	const [user, t] = await Promise.all([getSessionUser(), getTranslations('NotFound')])
	return (
		<ErrorPage
			scene={<LostScene />}
			title={t('title')}
			description={t('description')}
			action={
				user == null ? (
					<>
						<Link href="/" className={errorPageActionClassName}>
							{t('home')}
						</Link>
						<Link href="/sign-in" className={errorPageActionClassName}>
							{t('signIn')}
						</Link>
					</>
				) : (
					<Link href="/evaluations" className={errorPageActionClassName}>
						{t('evaluations')}
					</Link>
				)
			}
		/>
	)
}

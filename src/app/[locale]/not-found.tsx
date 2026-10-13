import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ErrorPage } from '@/components/error-page'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { getSessionUser } from '@/server/auth/session'
import { LostScene } from '@/components/pairsight/empty/scenes'

// Signed in, the way back is your evaluations; "/" is the signed-out landing.
export default async function NotFound() {
	const [user, t, tShell] = await Promise.all([
		getSessionUser(),
		getTranslations('NotFound'),
		getTranslations('Shell')
	])
	return (
		<ErrorPage
			scene={<LostScene />}
			eyebrow={t('eyebrow')}
			title={t('title')}
			description={t('description')}
			homeHref={user == null ? '/' : '/evaluations'}
			homeLabel={tShell('home')}
			actions={
				user == null ? (
					<>
						<Button asChild cap={<ArrowRightIcon />}>
							<Link href="/">{t('home')}</Link>
						</Button>
						<Button asChild variant="secondary">
							<Link href="/sign-in">{t('signIn')}</Link>
						</Button>
					</>
				) : (
					<Button asChild cap={<ArrowRightIcon />}>
						<Link href="/evaluations">{t('evaluations')}</Link>
					</Button>
				)
			}
		/>
	)
}

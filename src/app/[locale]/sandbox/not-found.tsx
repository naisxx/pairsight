import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ErrorPage, errorPageActionClassName } from '@/components/error-page'
import { LostScene } from '@/components/pairsight/empty/scenes'

// A demo link that's out of date: the way back is the demo itself, whoever's
// looking (the app-wide page offers Home or your evaluations).
export default async function SandboxNotFound() {
	const t = await getTranslations('NotFound')
	return (
		<ErrorPage
			scene={<LostScene />}
			title={t('title')}
			description={t('sandboxDescription')}
			action={
				<Link href="/sandbox" className={errorPageActionClassName}>
					{t('backToDemo')}
				</Link>
			}
		/>
	)
}

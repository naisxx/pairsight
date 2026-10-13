import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ErrorPage } from '@/components/error-page'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { LostScene } from '@/components/pairsight/empty/scenes'

// A demo link that's out of date: the way back is the demo itself, whoever's
// looking (the app-wide page offers Home or your evaluations).
export default async function SandboxNotFound() {
	const [t, tShell] = await Promise.all([getTranslations('NotFound'), getTranslations('Shell')])
	return (
		<ErrorPage
			scene={<LostScene />}
			eyebrow={t('eyebrow')}
			title={t('title')}
			description={t('sandboxDescription')}
			homeLabel={tShell('home')}
			actions={
				<Button asChild cap={<ArrowRightIcon />}>
					<Link href="/sandbox">{t('backToDemo')}</Link>
				</Button>
			}
		/>
	)
}

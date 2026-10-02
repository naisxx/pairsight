import { getTranslations } from 'next-intl/server'
import { DashboardScreen } from '@/components/pairsight/screens/dashboard-screen'
import { SANDBOX_VIEW } from '@/lib/pairsight/evaluation-view'
import { getDashboard } from '@/server/pairsight/dashboard'
import { SANDBOX_SCOPE } from '@/server/pairsight/scope'

export default async function SandboxPage() {
	const [t, dashboard] = await Promise.all([
		getTranslations('Sandbox'),
		getDashboard({ scope: SANDBOX_SCOPE, viewOf: () => SANDBOX_VIEW })
	])
	return (
		<DashboardScreen
			dashboard={dashboard}
			isReadOnly
			header={
				<header className="max-w-3xl">
					<h1 className="type-title">{t('title')}</h1>
					<p className="text-text-muted mt-1.5 text-sm leading-relaxed">{t('intro')}</p>
				</header>
			}
		/>
	)
}

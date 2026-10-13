import { getTranslations } from 'next-intl/server'
import { Greeting } from '@/components/pairsight/evaluations/greeting'
import { NewEvaluationButton } from '@/components/pairsight/evaluations/new-evaluation-button'
import {
	DashboardHeader,
	DashboardScreen,
	DashboardStats
} from '@/components/pairsight/screens/dashboard-screen'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { ownerView } from '@/lib/pairsight/evaluation-view'
import { requireUserOrRedirect } from '@/server/auth/session'
import { getDashboard } from '@/server/pairsight/dashboard'
import { ownerScope } from '@/server/pairsight/scope'
import { pageTitle } from '@/i18n/page-title'

export const generateMetadata = pageTitle('Evaluations')

export default async function EvaluationsPage() {
	const user = await requireUserOrRedirect('/evaluations')
	const [t, tShell, dashboard] = await Promise.all([
		getTranslations('Evaluations'),
		getTranslations('Shell'),
		getDashboard({ scope: ownerScope(user.id), viewOf: ownerView })
	])
	const firstName = user.name.split(/\s+/)[0] ?? user.name
	return (
		<AppShell
			scope={ownerScope(user.id)}
			viewer={{ email: user.email, name: user.name }}
			home={{ href: '/evaluations', label: tShell('evaluations') }}
			crumbs={[{ label: tShell('evaluations') }]}
		>
			<DashboardScreen
				dashboard={dashboard}
				isReadOnly={false}
				header={
					<DashboardHeader
						eyebrow={<Greeting firstName={firstName} />}
						title={t('headlineDone', { count: dashboard.stats.withResults })}
						subtitle={
							dashboard.rows.length === 0
								? t('headlineEmpty')
								: dashboard.stats.inSetup > 0
									? t('headlineSetup', { count: dashboard.stats.inSetup })
									: t('headlineOpen')
						}
						lead={dashboard.rows.length > 0 && <DashboardStats stats={dashboard.stats} />}
						action={
							dashboard.rows.length > 0 && (
								<NewEvaluationButton takenNames={dashboard.rows.map((row) => row.name)} />
							)
						}
					/>
				}
			/>
		</AppShell>
	)
}

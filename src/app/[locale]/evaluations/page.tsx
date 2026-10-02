import { getTranslations } from 'next-intl/server'
import { Greeting } from '@/components/pairsight/evaluations/greeting'
import { NewEvaluationButton } from '@/components/pairsight/evaluations/new-evaluation-button'
import { DashboardScreen } from '@/components/pairsight/screens/dashboard-screen'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { ownerView } from '@/lib/pairsight/evaluation-view'
import { requireUserOrRedirect } from '@/server/auth/session'
import { getDashboard } from '@/server/pairsight/dashboard'
import { ownerScope } from '@/server/pairsight/scope'

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
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<Greeting firstName={firstName} />
							<h1 className="type-title mt-0.5">{t('title')}</h1>
						</div>
						{dashboard.rows.length > 0 && (
							<NewEvaluationButton takenNames={dashboard.rows.map((row) => row.name)} />
						)}
					</header>
				}
			/>
		</AppShell>
	)
}

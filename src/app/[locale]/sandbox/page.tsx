import { getTranslations } from 'next-intl/server'
import { ErrorPage } from '@/components/error-page'
import { DashboardScreen } from '@/components/pairsight/screens/dashboard-screen'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { SandboxBanner } from '@/components/pairsight/shell/sandbox-banner'
import { sandboxView } from '@/lib/pairsight/evaluation-view'
import { SANDBOX_BASE } from '@/lib/pairsight/sandbox'
import { getProfileName, getSessionUser } from '@/server/auth/session'
import { getDashboard } from '@/server/pairsight/dashboard'
import { getSandboxRecording } from '@/server/pairsight/evaluation-pages'
import { SANDBOX_SCOPE } from '@/server/pairsight/scope'
import { pageTitle } from '@/i18n/page-title'

export const generateMetadata = pageTitle('Sandbox')

// The sandbox's dashboard: its three prepared evaluations (people,
// organisations, products), each opening read-only at /sandbox/<id>. Until
// `pnpm demo:seed` has run, it says so.
export default async function SandboxPage() {
	const [t, tShell, dashboard, recording, user] = await Promise.all([
		getTranslations('Sandbox'),
		getTranslations('Shell'),
		getDashboard({ scope: SANDBOX_SCOPE, viewOf: sandboxView }),
		getSandboxRecording(),
		getSessionUser()
	])
	if (recording == null) {
		return <ErrorPage title={t('missingTitle')} description={t('missingDescription')} />
	}
	const name = user == null ? null : await getProfileName(user.id)
	return (
		<AppShell
			scope={SANDBOX_SCOPE}
			viewer={user == null ? null : { email: user.email, name: name ?? user.email }}
			home={{ href: SANDBOX_BASE, label: tShell('sandbox') }}
			crumbs={[{ label: tShell('sandbox') }]}
			banner={<SandboxBanner recording={recording} isSignedIn={user != null} />}
		>
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
		</AppShell>
	)
}

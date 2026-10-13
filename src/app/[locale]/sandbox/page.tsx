import { getTranslations } from 'next-intl/server'
import { ErrorPage } from '@/components/error-page'
import { LostScene } from '@/components/pairsight/empty/scenes'
import { DashboardHeader, DashboardScreen } from '@/components/pairsight/screens/dashboard-screen'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { EXACT_FORMATS } from '@/i18n/formats'
import { Link } from '@/i18n/routing'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { SandboxBadge } from '@/components/pairsight/shell/sandbox-badge'
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
	const [t, tShell, tEvaluations, dashboard, recording, user] = await Promise.all([
		getTranslations('Sandbox'),
		getTranslations('Shell'),
		getTranslations('Evaluations'),
		getDashboard({ scope: SANDBOX_SCOPE, viewOf: sandboxView }),
		getSandboxRecording(),
		getSessionUser()
	])
	if (recording == null) {
		return (
			<ErrorPage
				scene={<LostScene />}
				title={t('missingTitle')}
				description={t('missingDescription')}
				homeHref={user == null ? '/' : '/evaluations'}
				homeLabel={tShell('home')}
			/>
		)
	}
	const name = user == null ? null : await getProfileName(user.id)
	return (
		<AppShell
			scope={SANDBOX_SCOPE}
			viewer={user == null ? null : { email: user.email, name: name ?? user.email }}
			home={{ href: SANDBOX_BASE, label: tShell('sandbox') }}
			crumbs={[{ label: tShell('sandbox') }]}
			badge={<SandboxBadge recording={recording} />}
		>
			<DashboardScreen
				dashboard={dashboard}
				isReadOnly
				header={
					<DashboardHeader
						eyebrow={t('eyebrow')}
						title={tEvaluations('headlineDone', { count: dashboard.finished.length })}
						subtitle={tEvaluations('headlineOpen')}
						lead={
							<p>
								{t(
									'intro',
									{
										records: Math.max(0, ...dashboard.rows.map((row) => row.recordCount ?? 0)),
										vendors: Math.max(0, ...dashboard.rows.map((row) => row.vendorCount))
									},
									EXACT_FORMATS
								)}
							</p>
						}
					/>
				}
				closer={
					<section
						aria-labelledby="try-it-title"
						className="bg-inverse text-on-inverse mt-14 flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-lg p-7"
					>
						<div className="flex-[1_1_400px]">
							<h2
								id="try-it-title"
								className="font-display text-[1.875rem] leading-[1.05] font-semibold tracking-[-0.025em]"
							>
								{t('ctaTitle')}
							</h2>
							<p className="mt-2 text-base opacity-75">{t('ctaBody')}</p>
						</div>
						<Button asChild cap={<ArrowRightIcon />}>
							<Link href={user == null ? '/sign-up' : '/evaluations'}>
								{user == null ? t('ctaSignUp') : t('ctaSignedIn')}
							</Link>
						</Button>
					</section>
				}
			/>
		</AppShell>
	)
}

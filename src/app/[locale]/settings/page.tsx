import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { JevSettings } from '@/components/pairsight/settings/jev-settings'
import { PeopleSettings } from '@/components/pairsight/settings/people-settings'
import { AppShell } from '@/components/pairsight/shell/app-shell'
import { env } from '@/lib/env'
import { getAdminContext } from '@/lib/rbac/context'
import { getJevConnectionStatus } from '@/server/ai/jev-credentials'
import { requireUserOrRedirect } from '@/server/auth/session'
import { isOnPrem } from '@/server/deployment'
import { ownerScope } from '@/server/pairsight/scope'
import { listPeople } from '@/server/settings/people'

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('Settings')
	return { title: t('title') }
}

// This server's setup, for everyone signed in to see; an admin with
// settings.manage changes it: the Jev key and address runs use. On-prem,
// admins also see who has an account and who's an admin.
export default async function SettingsPage() {
	const user = await requireUserOrRedirect('/settings')
	const [t, tShell, status, admin] = await Promise.all([
		getTranslations('Settings'),
		getTranslations('Shell'),
		getJevConnectionStatus(),
		getAdminContext()
	])
	const canSeePeople = isOnPrem() && (admin?.has('access.read') ?? false)
	const people = canSeePeople ? await listPeople() : []
	return (
		<AppShell
			scope={ownerScope(user.id)}
			viewer={{ email: user.email, name: user.name }}
			home={{ href: '/evaluations', label: tShell('evaluations') }}
			crumbs={[{ label: t('title') }]}
		>
			<header className="pt-4">
				<h1 className="font-display text-[clamp(2.5rem,4.6vw,4rem)] leading-[1.05] font-semibold tracking-[-0.025em]">
					{t('title')}
				</h1>
				<p className="text-text-body mt-4 max-w-[640px] text-[1.1875rem] leading-[1.875rem]">
					{t('description')}
				</p>
			</header>
			<JevSettings
				status={status}
				canManage={admin?.has('settings.manage') ?? false}
				defaultBaseUrl={env.TYPESAFE_API_BASE_URL}
			/>
			{canSeePeople && (
				<PeopleSettings
					people={people}
					viewerId={user.id}
					canManage={admin?.has('access.manage') ?? false}
				/>
			)}
		</AppShell>
	)
}

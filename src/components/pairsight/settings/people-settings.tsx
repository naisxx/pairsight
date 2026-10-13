import { getTranslations } from 'next-intl/server'
import { Chip } from '@/components/ui/chip'
import type { Person } from '@/server/settings/people'
import { AdminToggle } from './admin-toggle'

// On-prem, everyone with an account here and who's an admin: an admin can
// make others admins, or stop them being one (never themselves, never the
// last). Accounts live only on this machine.
export async function PeopleSettings({
	people,
	viewerId,
	canManage
}: {
	people: Person[]
	viewerId: string
	canManage: boolean
}) {
	const t = await getTranslations('Settings')
	return (
		<section
			aria-labelledby="people-title"
			className="bg-surface border-border mt-4 max-w-[720px] rounded-lg border p-6 md:p-7"
		>
			<h2 id="people-title" className="font-display text-2xl leading-tight font-semibold">
				{t('peopleTitle')}
			</h2>
			<p className="text-text-body mt-2">{t('peopleIntro')}</p>
			<ul className="mt-5">
				{people.map((person) => {
					const name = person.name ?? person.email
					return (
						<li
							key={person.id}
							className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t py-3.5"
						>
							<div className="min-w-0">
								<p className="flex flex-wrap items-center gap-2 font-semibold">
									<span className="truncate">{name}</span>
									{person.id === viewerId && (
										<span className="text-text-muted text-sm font-normal">{t('you')}</span>
									)}
									{person.isAdmin && <Chip tone="outline">{t('adminChip')}</Chip>}
								</p>
								{person.name != null && (
									<p className="text-text-muted truncate text-sm">{person.email}</p>
								)}
							</div>
							{canManage && person.id !== viewerId && (
								<AdminToggle userId={person.id} name={name} isAdmin={person.isAdmin} />
							)}
						</li>
					)
				})}
			</ul>
		</section>
	)
}

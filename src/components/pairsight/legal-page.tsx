import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { getSessionUser } from '@/server/auth/session'
import { SlimBar } from './slim-bar'

// A page of plain policy (Privacy, Terms): the slim bar, the title, when it
// was last changed, then each section as a heading and a paragraph, at a
// reading width.
export async function LegalPage({
	title,
	intro,
	updated,
	sections
}: {
	title: string
	intro: string
	updated: string
	sections: Array<{ title: string; body: string }>
}) {
	const [t, user] = await Promise.all([getTranslations('Legal'), getSessionUser()])
	return (
		<div className="bg-bg text-text flex min-h-dvh flex-col text-base">
			<SlimBar homeHref={user == null ? '/' : '/evaluations'} homeLabel={t('home')} />
			<main id="main" className="mx-auto w-full max-w-[720px] px-4 py-16 md:px-8">
				<h1 className="font-display text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.025em]">
					{title}
				</h1>
				<p className="text-text-body mt-3">{intro}</p>
				<p className="text-text-muted mt-2 font-mono text-sm">{updated}</p>
				{sections.map((section) => (
					<section key={section.title} className="border-border mt-8 border-t pt-6">
						<h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
							{section.title}
						</h2>
						<p className="text-text-body mt-2">{section.body}</p>
					</section>
				))}
				<p className="text-text-muted border-border mt-10 border-t pt-6 text-sm">
					<Link
						href="/"
						className="text-text decoration-border-strong hover:decoration-text inline-flex min-h-11 items-center underline underline-offset-[3px]"
					>
						{t('back')}
					</Link>
				</p>
			</main>
		</div>
	)
}

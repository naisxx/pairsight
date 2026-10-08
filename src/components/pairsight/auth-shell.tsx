import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Wordmark } from './wordmark'

// The single-column page sign-in, sign-up and onboarding share: the wordmark,
// a title and one sentence, then the form, arriving in that order over a
// soft brand glow (motion.css).
export async function AuthShell({
	title,
	description,
	homeHref = '/',
	children
}: {
	title: string
	description: string
	// Where the wordmark goes: the landing page signed out, evaluations in.
	homeHref?: '/' | '/evaluations'
	children: React.ReactNode
}) {
	const t = await getTranslations('Auth')
	return (
		<div className="bg-bg text-text relative isolate flex min-h-dvh flex-col">
			<div aria-hidden className="auth-backdrop" />
			<header className="drop flex h-16 items-center px-5 md:px-8">
				<Link href={homeHref} aria-label={t('home')} className="rounded-sm">
					<Wordmark />
				</Link>
			</header>
			<main id="main" className="flex flex-1 items-start justify-center px-5 pt-8 pb-16 md:pt-16">
				<div className="w-full max-w-[400px]">
					<h1 className="rise type-display-sm">{title}</h1>
					<p className="rise stagger-1 text-text-muted mt-1.5 text-sm">{description}</p>
					<div className="rise stagger-2">{children}</div>
				</div>
			</main>
		</div>
	)
}

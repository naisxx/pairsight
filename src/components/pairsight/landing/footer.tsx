import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Wordmark } from '../wordmark'
import { YOUR_DATA_ID } from './honest'

type FooterLink = { label: string; href: string; isPage?: boolean }

// Four columns: who checks the pairs, then the page's sections and the ways in.
export async function LandingFooter() {
	const t = await getTranslations('HomePage')
	const columns: Array<{ title: string; links: FooterLink[] }> = [
		{
			title: t('footerProduct'),
			links: [
				{ label: t('navHow'), href: '#how' },
				{ label: t('navLook'), href: '#look' },
				{ label: t('footerDemo'), href: '/sandbox', isPage: true }
			]
		},
		{
			title: t('footerTrust'),
			links: [
				{ label: t('navHonest'), href: '#honest' },
				{ label: t('limit4Title'), href: `#${YOUR_DATA_ID}` },
				{ label: t('navFaq'), href: '#faq' }
			]
		},
		{
			title: t('footerAccount'),
			links: [
				{ label: t('signIn'), href: '/sign-in', isPage: true },
				{ label: t('start'), href: '/sign-up', isPage: true }
			]
		}
	]
	const linkClass = 'text-text-muted hover:text-text text-sm transition-colors duration-150'
	return (
		<footer className="border-border border-t">
			<div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-10 px-4 py-16 sm:grid-cols-3 md:px-8 lg:grid-cols-[2fr_1fr_1fr_1fr]">
				<div className="col-span-full lg:col-span-1">
					<Wordmark />
					<p className="text-text-muted mt-3 max-w-xs text-sm leading-relaxed">{t('footer')}</p>
				</div>
				{columns.map((column) => (
					<nav key={column.title} aria-label={column.title}>
						<h2 className="text-text-muted type-eyebrow">{column.title}</h2>
						<ul className="mt-3 space-y-2">
							{column.links.map((link) => (
								<li key={link.href}>
									{link.isPage === true ? (
										<Link href={link.href} className={linkClass}>
											{link.label}
										</Link>
									) : (
										<a href={link.href} className={linkClass}>
											{link.label}
										</a>
									)}
								</li>
							))}
						</ul>
					</nav>
				))}
			</div>
		</footer>
	)
}

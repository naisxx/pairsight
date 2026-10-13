import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { Wordmark } from '../wordmark'
import { DISPLAY, WRAP } from './parts'

// The closing mark: an 8 by 8 mosaic, agreement in the middle, the vendor's
// lone merges on the left, Jev's on the right, the corners empty.
const MARK_SIZE = 8
const MARK_CENTRE = (MARK_SIZE - 1) / 2
const MARK_EDGE = 4.4
const MARK_CORE = 2.6
const MARK_TILES = Array.from({ length: MARK_SIZE * MARK_SIZE }, (_, index) => {
	const x = index % MARK_SIZE
	const distance = Math.hypot(x - MARK_CENTRE, Math.floor(index / MARK_SIZE) - MARK_CENTRE)
	return distance > MARK_EDGE
		? 'bg-border'
		: distance < MARK_CORE
			? 'bg-text'
			: x < MARK_SIZE / 2
				? 'bg-brand'
				: 'bg-ice'
})

const FOOTER_LINK =
	'landing-press text-text-body hover:text-text flex min-h-10 items-center transition-colors duration-150'

// The landing's close (pairsight-handoff Landing): two views, one decision,
// the ways in, and the links.
export async function LandingFooter() {
	const t = await getTranslations('HomePage')
	const columns = [
		{
			title: t('footerProduct'),
			links: [
				{ label: t('navHow'), href: '#how' },
				{ label: t('navInside'), href: '#inside' },
				{ label: t('footerDemo'), href: '/sandbox', isPage: true }
			]
		},
		{
			title: t('footerTrust'),
			links: [
				{ label: t('navHonest'), href: '#honest' },
				{ label: t('footerYourData'), href: '#your-data' }
			]
		},
		{
			title: t('footerAccount'),
			links: [
				{ label: t('signIn'), href: '/sign-in', isPage: true },
				{ label: t('createAccount'), href: '/sign-up', isPage: true }
			]
		},
		{
			title: t('footerLegal'),
			links: [
				{ label: t('footerPrivacy'), href: '/privacy', isPage: true },
				{ label: t('footerTerms'), href: '/terms', isPage: true }
			]
		}
	]

	return (
		<footer className="bg-bg max-[599px]:border-border relative overflow-clip max-[599px]:border-t">
			<div className={cn(WRAP, 'pt-32 max-[599px]:pt-16')}>
				<div className="flex flex-wrap items-center justify-between gap-12">
					<div className="flex-[1_1_520px]">
						<h2 className={cn('text-[clamp(54px,7vw,104px)] max-[599px]:text-5xl', DISPLAY)}>
							{t('ctaTitleLine1')} <br />
							{t('ctaTitleLine2')}
						</h2>
						<div className="mt-10 flex flex-wrap gap-3.5 max-[599px]:mt-7 max-[599px]:flex-col max-[599px]:items-stretch">
							<Button
								asChild
								size="lg"
								cap={<ArrowRightIcon />}
								className="landing-cta max-[599px]:h-[52px] max-[599px]:justify-between max-[599px]:rounded-[12px]"
							>
								<Link href="/sign-up">{t('start')}</Link>
							</Button>
							<Button asChild size="lg" variant="secondary" className="max-[599px]:hidden">
								<Link href="/sandbox">{t('openDemo')}</Link>
							</Button>
						</div>
					</div>
					<div
						aria-hidden
						className="landing-mark mr-20 hidden w-[340px] flex-none grid-cols-8 gap-1.5 min-[820px]:grid"
					>
						{MARK_TILES.map((tone, index) => (
							// The mark never changes, so a tile's place is its identity.
							<span key={index} className={cn('aspect-square rounded-[4px]', tone)} />
						))}
					</div>
				</div>

				<div className="border-border mt-28 flex flex-wrap gap-x-[72px] gap-y-9 border-t pt-10 max-[599px]:hidden">
					<div className="max-w-[320px] flex-[1_1_260px]">
						<Wordmark labelClassName="text-2xl" />
						<p className="text-text-body mt-3.5">{t('footerTagline')}</p>
					</div>
					{columns.map((column) => (
						<nav key={column.title} aria-label={column.title}>
							<p className="text-text-muted mb-2.5 font-mono text-[0.8125rem] tracking-[0.06em] uppercase">
								{column.title}
							</p>
							{column.links.map((link) =>
								link.isPage === true ? (
									<Link key={link.href} href={link.href} className={FOOTER_LINK}>
										{link.label}
									</Link>
								) : (
									<a key={link.href} href={link.href} className={FOOTER_LINK}>
										{link.label}
									</a>
								)
							)}
						</nav>
					))}
				</div>
				{/* A phone gets the main links in two columns (pairsight-handoff Phone). */}
				<nav
					aria-label={t('footerLinks')}
					className="border-border mt-12 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-6 min-[600px]:hidden"
				>
					<a href="#how" className={cn(FOOTER_LINK, 'min-h-11')}>
						{t('navHow')}
					</a>
					<Link href="/sandbox" className={cn(FOOTER_LINK, 'min-h-11')}>
						{t('footerDemo')}
					</Link>
					<Link href="/sign-in" className={cn(FOOTER_LINK, 'min-h-11')}>
						{t('signIn')}
					</Link>
					<Link href="/privacy" className={cn(FOOTER_LINK, 'min-h-11')}>
						{t('footerPrivacy')}
					</Link>
				</nav>
				{/* TODO(legal name): the design's "© 2026 [COMPANY LEGAL NAME]" goes on
				    the left once the legal name is known. */}
				<p className="text-text-muted flex justify-end pt-10 pb-9 text-sm max-[599px]:justify-start max-[599px]:pt-6 max-[599px]:pb-16">
					{t('footerDisclaimer')}
				</p>
			</div>
		</footer>
	)
}

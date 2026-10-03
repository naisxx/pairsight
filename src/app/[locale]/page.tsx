import { Fragment } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ProductPreview } from '@/components/pairsight/product-preview'
import { ThemeMenu } from '@/components/pairsight/theme-menu'
import { Wordmark } from '@/components/pairsight/wordmark'
import { Button } from '@/components/ui/button'
import { InView } from '@/components/ui/in-view'
import { CloserLook } from '@/components/pairsight/landing/closer-look'
import { HowItWorks } from '@/components/pairsight/landing/how-it-works'
import { ArrowRightIcon } from '@/components/ui/icons'
import { redirectIfSignedIn } from '@/server/auth/session'

const LIMITS = [
	{ title: 'limit1Title', body: 'limit1Body' },
	{ title: 'limit2Title', body: 'limit2Body' },
	{ title: 'limit3Title', body: 'limit3Body' }
] as const

const ARROW_SIZE = 16
// The hero copy arrives after the headline's words (motion.css: .rise steps
// 70 ms apart; the headline's last word lands at about 650 ms).
const AFTER_HEADLINE = 10

// The signed-out landing page: what PairSight does, how, and what its
// numbers do and don't mean. Signed in, "/" goes straight to evaluations.
export default async function HomePage() {
	await redirectIfSignedIn()
	const t = await getTranslations('HomePage')
	const words = t('heroTitleLead').split(' ')
	return (
		<div className="bg-bg text-text min-h-dvh">
			<div className="landing-header">
				<header className="drop mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-5 md:px-8">
					<Link href="/" aria-label={t('home')} className="rounded-sm">
						<Wordmark />
					</Link>
					<nav aria-label={t('accountNav')} className="ml-auto flex items-center gap-1.5">
						<ThemeMenu />
						<Button variant="quiet" size="sm" asChild>
							<Link href="/sign-in">{t('signIn')}</Link>
						</Button>
					</nav>
				</header>
			</div>

			<main id="main">
				<section className="relative isolate">
					<div aria-hidden className="hero-backdrop">
						<span className="hero-blob hero-blob--a" />
						<span className="hero-blob hero-blob--b" />
						<span className="hero-blob hero-blob--c" />
					</div>
					<div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-5 pt-10 pb-16 md:px-8 lg:grid-cols-12 lg:pt-16">
						<div className="lg:col-span-5">
							<p className="rise border-border bg-surface/70 text-text-muted type-ui inline-flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur">
								<span aria-hidden className="live-dot" />
								{t('heroEyebrow')}
							</p>
							<h1 className="hero-words mt-5 text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[40px]">
								{words.map((word, index) => (
									<Fragment key={`${index}-${word}`}>
										<span className={`rise stagger-${index}`}>{word}</span>{' '}
									</Fragment>
								))}
								<span className={`text-gradient unblur stagger-${words.length}`}>
									{t('heroTitleAccent')}
								</span>
							</h1>
							<p
								className={`rise stagger-${AFTER_HEADLINE} text-text-muted mt-5 max-w-lg text-[15px] leading-relaxed`}
							>
								{t('heroBody')}
							</p>
							<div className={`rise stagger-${AFTER_HEADLINE + 1} mt-7 flex flex-wrap gap-3`}>
								<Button size="lg" className="sheen group" asChild>
									<Link href="/sign-up">
										{t('start')}
										<ArrowRightIcon
											size={ARROW_SIZE}
											className="transition-transform duration-200 group-hover:translate-x-1"
										/>
									</Link>
								</Button>
								<Button size="lg" variant="secondary" asChild>
									<Link href="/sandbox">{t('explore')}</Link>
								</Button>
							</div>
							<p className={`rise stagger-${AFTER_HEADLINE + 2} type-ui text-text-muted mt-4`}>
								{t('heroNote')}
							</p>
						</div>
						<div className="lg:col-span-7">
							<div className="hero-preview">
								<div className="hero-float">
									<ProductPreview />
								</div>
							</div>
						</div>
					</div>
				</section>

				<HowItWorks />

				<CloserLook />

				<section
					aria-labelledby="limits-title"
					className="mx-auto max-w-[1200px] px-5 py-14 md:px-8"
				>
					<InView className="grid grid-cols-1 gap-8 lg:grid-cols-12">
						<div className="on-view lg:col-span-4">
							<h2 id="limits-title" className="text-xl font-semibold tracking-[-0.01em]">
								{t('limitsTitle')}
							</h2>
							<p className="text-text-muted mt-2 text-sm leading-relaxed">{t('limitsBody')}</p>
						</div>
						<dl className="divide-border divide-y lg:col-span-8">
							{LIMITS.map((limit, index) => (
								<div
									key={limit.title}
									className={`on-view stagger-${index + 1} grid gap-1 py-4 first:pt-0 md:grid-cols-[220px_1fr] md:gap-6`}
								>
									<dt className="text-sm font-semibold">{t(limit.title)}</dt>
									<dd className="text-text-muted text-sm leading-relaxed">{t(limit.body)}</dd>
								</div>
							))}
						</dl>
					</InView>
				</section>

				<section className="mx-auto max-w-[1200px] px-5 pb-16 md:px-8">
					<InView className="cta-panel flex flex-wrap items-center justify-between gap-6 rounded-xl px-6 py-10 md:px-10">
						<div className="on-view max-w-xl">
							<p className="text-xl font-semibold tracking-[-0.01em] md:text-2xl">
								{t('ctaTitle')}
							</p>
							<p className="mt-2 text-sm text-white/80">{t('ctaBody')}</p>
						</div>
						<div className="on-view stagger-1 flex flex-wrap gap-3">
							<Button
								size="lg"
								className="sheen text-brand-deep bg-white hover:bg-white/90"
								asChild
							>
								<Link href="/sign-up">{t('start')}</Link>
							</Button>
							<Button
								size="lg"
								variant="secondary"
								className="border-white/40 bg-transparent text-white hover:bg-white/10"
								asChild
							>
								<Link href="/sandbox">{t('explore')}</Link>
							</Button>
						</div>
					</InView>
				</section>
			</main>

			<footer className="text-text-muted mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs md:px-8">
				<Wordmark />
				<span>{t('footer')}</span>
			</footer>
		</div>
	)
}

import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ProductPreview } from '@/components/pairsight/product-preview'
import { ThemeMenu } from '@/components/pairsight/theme-menu'
import { Wordmark } from '@/components/pairsight/wordmark'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { redirectIfSignedIn } from '@/server/auth/session'

const STEPS = [
	{ title: 'step1Title', body: 'step1Body' },
	{ title: 'step2Title', body: 'step2Body' },
	{ title: 'step3Title', body: 'step3Body' }
] as const

const LIMITS = [
	{ title: 'limit1Title', body: 'limit1Body' },
	{ title: 'limit2Title', body: 'limit2Body' },
	{ title: 'limit3Title', body: 'limit3Body' }
] as const

const ARROW_SIZE = 16

// The signed-out landing page: what PairSight does, how, and what its
// numbers do and don't mean. Signed in, "/" goes straight to evaluations.
export default async function HomePage() {
	await redirectIfSignedIn()
	const t = await getTranslations('HomePage')
	return (
		<div className="bg-bg text-text min-h-dvh">
			<header className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-5 md:px-8">
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

			<main id="main">
				<section className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 pt-10 pb-16 md:px-8 lg:grid-cols-12 lg:pt-16">
					<div className="lg:col-span-5">
						<h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[40px]">
							{t('heroTitle')}
						</h1>
						<p className="text-text-muted mt-5 max-w-lg text-[15px] leading-relaxed">
							{t('heroBody')}
						</p>
						<div className="mt-7 flex flex-wrap gap-3">
							<Button size="lg" asChild>
								<Link href="/sign-up">
									{t('start')}
									<ArrowRightIcon size={ARROW_SIZE} />
								</Link>
							</Button>
						</div>
						<p className="type-ui text-text-muted mt-4">{t('heroNote')}</p>
					</div>
					<div className="lg:col-span-7">
						<ProductPreview />
					</div>
				</section>

				<section aria-labelledby="how-title" className="border-border bg-surface border-y">
					<div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
						<h2 id="how-title" className="text-xl font-semibold tracking-[-0.01em]">
							{t('howTitle')}
						</h2>
						<ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
							{STEPS.map((step, index) => (
								<li key={step.title} className="relative md:pt-10">
									<span className="border-action text-accent-ink flex size-7 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold md:absolute md:top-0 md:left-0">
										{index + 1}
									</span>
									{index < STEPS.length - 1 && (
										<span
											aria-hidden
											className="bg-border absolute top-3.5 right-[-24px] left-9 hidden h-px md:block"
										/>
									)}
									<h3 className="mt-3 text-[15px] font-semibold md:mt-0">{t(step.title)}</h3>
									<p className="text-text-muted mt-1.5 text-sm leading-relaxed">{t(step.body)}</p>
								</li>
							))}
						</ol>
					</div>
				</section>

				<section
					aria-labelledby="limits-title"
					className="mx-auto max-w-[1200px] px-5 py-14 md:px-8"
				>
					<div className="grid gap-8 lg:grid-cols-12">
						<div className="lg:col-span-4">
							<h2 id="limits-title" className="text-xl font-semibold tracking-[-0.01em]">
								{t('limitsTitle')}
							</h2>
							<p className="text-text-muted mt-2 text-sm leading-relaxed">{t('limitsBody')}</p>
						</div>
						<dl className="divide-border divide-y lg:col-span-8">
							{LIMITS.map((limit) => (
								<div
									key={limit.title}
									className="grid gap-1 py-4 first:pt-0 md:grid-cols-[220px_1fr] md:gap-6"
								>
									<dt className="text-sm font-semibold">{t(limit.title)}</dt>
									<dd className="text-text-muted text-sm leading-relaxed">{t(limit.body)}</dd>
								</div>
							))}
						</dl>
					</div>
				</section>

				<section className="border-border bg-surface border-t">
					<div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-10 md:px-8">
						<p className="text-[15px] font-medium">{t('ctaTitle')}</p>
						<Button asChild>
							<Link href="/sign-up">{t('start')}</Link>
						</Button>
					</div>
				</section>
			</main>

			<footer className="text-text-muted mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs md:px-8">
				<Wordmark />
				<span>{t('footer')}</span>
			</footer>
		</div>
	)
}

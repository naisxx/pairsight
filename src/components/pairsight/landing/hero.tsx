import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import type { LandingDemo } from '@/server/pairsight/landing-demo'
import { HeroResults } from './hero-results'
import { IntroItem, IntroSequence } from './landing-motion'

const ARROW_SIZE = 16

// What PairSight is, the two ways in, and the demo's real results to play with.
export async function Hero({ demo }: { demo: LandingDemo }) {
	const t = await getTranslations('HomePage')
	return (
		<section className="landing-glow relative isolate">
			<IntroSequence className="mx-auto max-w-[1200px] px-4 pt-28 pb-20 md:px-8 lg:pt-36 lg:pb-28">
				<div className="mx-auto flex max-w-3xl flex-col items-center text-center">
					<IntroItem>
						<p className="border-border bg-surface/70 text-text-muted type-ui inline-flex items-center gap-2 rounded-full border px-3 py-1">
							<span aria-hidden className="bg-action size-1.5 rounded-full" />
							{t('heroEyebrow')}
						</p>
					</IntroItem>
					<IntroItem>
						<h1 className="mt-5 text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance md:text-[52px]">
							{t('heroTitleLead')} <span className="text-gradient">{t('heroTitleAccent')}</span>
						</h1>
					</IntroItem>
					<IntroItem>
						<p className="text-text-muted mt-5 max-w-2xl text-base leading-relaxed md:text-lg">
							{t('heroBody')}
						</p>
					</IntroItem>
					<IntroItem className="mt-8 flex flex-wrap justify-center gap-3">
						<Button size="lg" className="group" asChild>
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
					</IntroItem>
					<IntroItem>
						<p className="type-ui text-text-muted mt-4">{t('heroNote')}</p>
					</IntroItem>
				</div>
				<IntroItem className="mx-auto mt-14 max-w-[1080px] md:mt-16">
					<HeroResults demo={demo} />
					<p className="text-text-muted mt-3 text-center text-xs">{t('panelNote')}</p>
				</IntroItem>
			</IntroSequence>
		</section>
	)
}

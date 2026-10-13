import { Bento } from '@/components/pairsight/landing/bento'
import { Faq } from '@/components/pairsight/landing/faq'
import { Figures } from '@/components/pairsight/landing/figures'
import { LandingFooter } from '@/components/pairsight/landing/footer'
import { Hero } from '@/components/pairsight/landing/hero'
import { LandingMotion } from '@/components/pairsight/landing/landing-motion'
import { Honest } from '@/components/pairsight/landing/honest'
import { LandingNav } from '@/components/pairsight/landing/nav'
import { PhoneInspector } from '@/components/pairsight/landing/phone-inspector'
import { Ticker } from '@/components/pairsight/landing/ticker'
import { Walkthrough } from '@/components/pairsight/landing/walkthrough'
import '@/components/pairsight/landing/landing.css'
import { getTranslations } from 'next-intl/server'
import { redirectIfSignedIn } from '@/server/auth/session'
import { landingDemo } from '@/server/pairsight/landing-demo'

// The signed-out landing page (pairsight-handoff Landing): what PairSight
// does, the products demo's real results, how a pair gets checked, what you
// get, what the numbers do and don't mean, and the questions people ask.
// Signed in, "/" goes straight to evaluations.
export default async function HomePage() {
	await redirectIfSignedIn()
	const demo = landingDemo()
	const t = await getTranslations('Shell')
	return (
		<div data-landing className="bg-bg text-text relative min-h-dvh overflow-clip text-base">
			<LandingMotion />
			<a
				href="#main"
				className="bg-surface text-text sr-only rounded-sm px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:inline-flex focus:min-h-11 focus:items-center"
			>
				{t('skipToContent')}
			</a>
			{/* The ground: lines and dots, lit vermilion and ice where the pointer
			    is (resting top right until it moves). The bar, the ticker and the
			    footer sit over it. */}
			<div aria-hidden data-landing-grid className="landing-grid pointer-events-none">
				<i className="landing-glow-ice" />
				<i className="landing-glow-brand" />
			</div>
			<LandingNav />
			<main id="main">
				<Hero demo={demo} />
				<Ticker rows={demo.ticker} />
				<Walkthrough demo={demo} />
				<PhoneInspector demo={demo} />
				<Bento demo={demo} />
				<Honest />
				<Figures demo={demo} />
				<Faq />
			</main>
			<LandingFooter />
		</div>
	)
}

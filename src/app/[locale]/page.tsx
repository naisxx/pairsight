import { CloserLook } from '@/components/pairsight/landing/closer-look'
import { Faq } from '@/components/pairsight/landing/faq'
import { FinalCta } from '@/components/pairsight/landing/final-cta'
import { LandingFooter } from '@/components/pairsight/landing/footer'
import { Hero } from '@/components/pairsight/landing/hero'
import { Honest } from '@/components/pairsight/landing/honest'
import { LandingMotion } from '@/components/pairsight/landing/landing-motion'
import { LandingNav } from '@/components/pairsight/landing/nav'
import { Story } from '@/components/pairsight/landing/story'
import { Who } from '@/components/pairsight/landing/who'
import { redirectIfSignedIn } from '@/server/auth/session'
import { landingDemo, landingStats } from '@/server/pairsight/landing-demo'
import { StatBand } from '@/components/pairsight/landing/stats'

// The signed-out landing page: what PairSight does, the demo's real results to
// play with, how it works, who it's for and what its numbers do and don't
// mean. Signed in, "/" goes straight to evaluations.
export default async function HomePage() {
	await redirectIfSignedIn()
	const demo = landingDemo()
	return (
		<LandingMotion>
			<div className="bg-bg text-text min-h-dvh">
				<LandingNav />
				<main id="main">
					<Hero demo={demo} />
					<StatBand stats={landingStats()} />
					<Story demo={demo} />
					<CloserLook />
					<Who />
					<Honest />
					<Faq />
					<FinalCta demo={demo} />
				</main>
				<LandingFooter />
			</div>
		</LandingMotion>
	)
}

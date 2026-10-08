import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { agreedCount } from '@/lib/pairsight/agreement'
import { vendorMetrics } from '@/lib/pairsight/metrics'
import { rankVendors } from '@/lib/pairsight/ranking'
import type { LandingDemo } from '@/server/pairsight/landing-demo'
import { ScrollReveal } from './landing-motion'

const ARROW_SIZE = 16
const PERCENT = 100

// Each demo vendor's overall score at the demo's cut-off, best first: the
// Results headline in miniature, ranked the same way (ranking.ts), with how
// often it agreed with Jev underneath.
function ranking(demo: LandingDemo) {
	return rankVendors(
		demo.vendors.map((vendor, index) => {
			const metrics = vendorMetrics(
				demo.scores.map((pair) => ({
					status: 'succeeded' as const,
					score: pair.score,
					isVendorMatch: pair.matchedBy.includes(index)
				})),
				demo.threshold
			)
			return { name: vendor.name, metrics, share: metrics.f1 ?? 0, agreed: agreedCount(metrics) }
		})
	)
}

// The closing ask: a full coral band (the brand at its biggest), with a
// fragment of the product beside it that always wears the dark theme.
export async function FinalCta({ demo }: { demo: LandingDemo }) {
	const t = await getTranslations('HomePage')
	const vendors = ranking(demo)
	return (
		<section
			aria-labelledby="final-title"
			className="mx-auto max-w-[1200px] px-4 py-24 md:px-8 md:py-32"
		>
			<ScrollReveal>
				<div className="bg-action text-action-ink relative isolate grid items-center gap-10 overflow-hidden rounded-lg px-6 py-12 md:px-12 md:py-16 lg:grid-cols-12">
					<div className="lg:col-span-7">
						<h2 id="final-title" className="type-display-lg text-balance">
							{t('ctaTitleLead')} {t('ctaTitleAccent')}
						</h2>
						<p className="mt-5 max-w-lg text-base leading-relaxed md:text-lg">{t('ctaBody')}</p>
						<div className="mt-9 flex flex-wrap gap-3">
							<Button
								size="lg"
								className="group bg-text text-bg hover:bg-text active:bg-text hover:opacity-90"
								asChild
							>
								<Link href="/sign-up">
									{t('start')}
									<ArrowRightIcon
										size={ARROW_SIZE}
										className="transition-transform duration-200 group-hover:translate-x-1"
									/>
								</Link>
							</Button>
							<Button
								size="lg"
								variant="quiet"
								className="text-action-ink hover:text-action-ink border border-current hover:bg-black/10"
								asChild
							>
								<Link href="/sandbox">{t('explore')}</Link>
							</Button>
						</div>
					</div>

					{/* A head-to-head card from the demo's real run. */}
					<figure className="dark bg-surface text-text border-border rounded-lg border p-5 md:p-6 lg:col-span-5">
						<figcaption className="text-text-muted type-eyebrow">
							{t('ctaFragmentTitle')}
						</figcaption>
						<ul className="mt-4 flex flex-col gap-5">
							{vendors.map((vendor, index) => (
								<li key={vendor.name}>
									<div className="flex items-baseline justify-between gap-3">
										<span className="type-subheading">{vendor.name}</span>
										<span className="font-mono text-2xl font-medium">
											{(vendor.share * PERCENT).toFixed(1)}%
										</span>
									</div>
									<div aria-hidden className="bg-border mt-2 h-1.5 overflow-hidden rounded-full">
										<div
											className={
												index === 0
													? 'bg-action h-full rounded-full'
													: 'bg-text-muted h-full rounded-full'
											}
											style={{ width: `${vendor.share * PERCENT}%` }}
										/>
									</div>
									<p className="text-text-muted mt-1.5 text-xs">
										{t('ctaFragmentAgreed', { agreed: vendor.agreed, total: demo.scores.length })}
									</p>
								</li>
							))}
						</ul>
					</figure>
				</div>
			</ScrollReveal>
		</section>
	)
}

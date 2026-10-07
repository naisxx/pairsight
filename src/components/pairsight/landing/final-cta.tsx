import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { LogoGlyph } from '../wordmark'
import { ScrollReveal } from './landing-motion'

const ARROW_SIZE = 16

// The closing ask. The panel always wears the dark theme (its `dark` class
// switches the tokens inside it), with a soft glow of the action colour.
export async function FinalCta() {
	const t = await getTranslations('HomePage')
	return (
		<section aria-labelledby="final-title" className="mx-auto max-w-[1200px] px-4 py-24 md:px-8">
			<ScrollReveal>
				<div className="dark final-glow bg-bg text-text border-border relative isolate overflow-hidden rounded-lg border px-6 py-16 text-center md:px-12 md:py-20">
					<LogoGlyph className="mx-auto h-6 w-8" />
					<h2
						id="final-title"
						className="mx-auto mt-6 max-w-2xl text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[40px]"
					>
						{t('ctaTitleLead')} <span className="text-gradient">{t('ctaTitleAccent')}</span>
					</h2>
					<p className="text-text-muted mx-auto mt-5 max-w-lg leading-relaxed">{t('ctaBody')}</p>
					<div className="mt-9 flex flex-wrap justify-center gap-3">
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
					</div>
				</div>
			</ScrollReveal>
		</section>
	)
}

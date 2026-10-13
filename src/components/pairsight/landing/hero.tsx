import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { LandingDemo } from '@/server/pairsight/landing-demo'
import { HeroPanel } from './hero-panel'
import { DISPLAY, Eyebrow, LandingGlyph, WRAP } from './parts'

// A pair from the demo, pinned to a corner of the panel: Jev's surest and
// the merge it doubts most. It repeats what the panel shows, so it's hidden
// from screen readers.
function FloatingPair({
	kind,
	name,
	score,
	className
}: {
	kind: 'same' | 'different'
	name: string
	score: number
	className: string
}) {
	return (
		<span
			aria-hidden
			className={cn(
				'bg-surface border-border landing-shadow absolute z-[3] hidden min-h-10 items-center gap-2.5 rounded-[12px] border pr-3.5 pl-2 font-mono text-[0.8125rem] whitespace-nowrap min-[900px]:inline-flex',
				className
			)}
		>
			<LandingGlyph kind={kind} />
			{name} <strong>{score.toFixed(2)}</strong>
		</span>
	)
}

// The landing's opening (pairsight-handoff Landing): the claim, the way into
// the demo, and beside it the demo's real results, one tile per checked
// pair.
export async function Hero({ demo }: { demo: LandingDemo }) {
	const t = await getTranslations('HomePage')
	return (
		<section id="top" data-landing-hero aria-labelledby="hero-title" className="relative">
			<div aria-hidden className="landing-spot max-[599px]:hidden" />
			<svg
				aria-hidden
				className="pointer-events-none absolute inset-0 size-full opacity-[0.09] mix-blend-overlay max-[599px]:hidden"
			>
				<filter id="landing-grain">
					<feTurbulence
						type="fractalNoise"
						baseFrequency=".9"
						numOctaves={2}
						stitchTiles="stitch"
					/>
				</filter>
				<rect width="100%" height="100%" filter="url(#landing-grain)" />
			</svg>
			<div
				className={cn(
					WRAP,
					'flex flex-wrap items-center gap-x-12 gap-y-14 pt-20 pb-28 max-[599px]:gap-y-9 max-[599px]:pt-12 max-[599px]:pb-14'
				)}
			>
				<div className="min-w-0 flex-[1_1_520px]">
					<div className="landing-arrive">
						<Eyebrow glyph="same">
							<span className="max-[599px]:hidden">{t('heroEyebrow')}</span>
							<span className="min-[600px]:hidden">{t('heroEyebrowShort')}</span>
						</Eyebrow>
					</div>
					<h1
						id="hero-title"
						className={cn(
							'landing-arrive mt-7 text-[clamp(42px,4.7vw,68px)] [animation-delay:80ms] max-[599px]:mt-[22px] max-[599px]:text-[52px] min-[600px]:whitespace-nowrap',
							DISPLAY
						)}
					>
						{t('heroTitleLine1')} <br />
						{t('heroTitleLine2')} <br />
						<span className="landing-double" data-text={t('heroTitleAccent')}>
							{t('heroTitleAccent')}
						</span>{' '}
						{t('heroTitleEnd')}
					</h1>
					<p className="landing-arrive text-text-body mt-7 max-w-[500px] text-[19px] leading-[30px] [animation-delay:160ms] max-[599px]:mt-[22px] max-[599px]:text-lg max-[599px]:leading-7">
						<span className="max-[599px]:hidden">{t('heroBody')}</span>
						<span className="min-[600px]:hidden">{t('heroBodyShort')}</span>
					</p>
					<div className="landing-arrive mt-9 flex flex-wrap items-center gap-3.5 [animation-delay:240ms] max-[599px]:mt-7 max-[599px]:flex-col max-[599px]:items-stretch max-[599px]:gap-2.5">
						<Button
							asChild
							size="lg"
							cap={<ArrowRightIcon />}
							className="landing-cta max-[599px]:h-[52px] max-[599px]:justify-between max-[599px]:rounded-[12px]"
						>
							<Link href="/sandbox">{t('openDemo')}</Link>
						</Button>
						<Button
							asChild
							size="lg"
							variant="secondary"
							className="max-[599px]:h-[52px] max-[599px]:rounded-[12px]"
						>
							<a href="#how">{t('seeHow')}</a>
						</Button>
					</div>
					<p className="landing-arrive text-text-muted mt-4 text-sm [animation-delay:300ms] max-[599px]:mt-3">
						<span className="max-[599px]:hidden">{t('heroNote')}</span>
						<span className="min-[600px]:hidden">{t('heroNoteShort')}</span>
					</p>
				</div>

				<div className="min-w-0 flex-[1_1_520px]">
					<div className="relative">
						<FloatingPair
							kind="same"
							name={demo.story.name}
							score={demo.story.score}
							className="landing-float -top-5 -left-[34px]"
						/>
						<FloatingPair
							kind="different"
							name={demo.doubted.name}
							score={demo.doubted.score}
							className="landing-float -right-[26px] -bottom-[18px] [animation-delay:-3s]"
						/>
						<section
							aria-label={t('panelLabel')}
							className="landing-stage bg-surface/62 border-border landing-shadow rounded-[28px] border px-6 pt-[22px] pb-6 backdrop-blur-[18px] max-[599px]:rounded-[20px] max-[599px]:p-4"
						>
							<HeroPanel vendors={demo.vendors} />
						</section>
					</div>
					<p className="text-text-muted mt-3.5 text-sm max-[599px]:mt-2.5">{t('panelNote')}</p>
				</div>
			</div>
		</section>
	)
}

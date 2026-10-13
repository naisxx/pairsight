import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import { REVEAL_RANGE } from './bento'
import { DISPLAY, Eyebrow, LandingGlyph, SECTION, SectionTitle, WRAP } from './parts'

// The four things the numbers don't mean, and the one about your data.
const TRUTHS = [
	{ key: 'truth1', glyph: 'different' },
	{ key: 'truth2', glyph: 'different' },
	{ key: 'truth3', glyph: 'different' },
	{ key: 'truth4', glyph: 'same', id: 'your-data' }
] as const

// What it measures (pairsight-handoff Landing): a second opinion, not a
// certificate, said four ways, over two hairline rings.
export async function Honest() {
	const t = await getTranslations('HomePage')
	return (
		<section
			id="honest"
			aria-labelledby="honest-title"
			className={cn(SECTION, 'max-[599px]:bg-surface-muted overflow-clip')}
		>
			<span
				aria-hidden
				data-range="entry 0% exit 100%"
				className="landing-drift border-border absolute top-[220px] -left-40 size-[420px] rounded-full border-[1.5px] max-[599px]:hidden"
			/>
			<span
				aria-hidden
				data-range="entry 20% exit 80%"
				className="landing-drift border-border absolute top-[220px] left-10 size-[420px] rounded-full border-[1.5px] max-[599px]:hidden"
			/>
			<div className={WRAP}>
				<Eyebrow glyph="different" tone="brand">
					{t('honestEyebrow')}
				</Eyebrow>
				<SectionTitle
					id="honest-title"
					lead={t('honestTitle')}
					accent={t('honestTitleAccent')}
					className="max-w-[900px]"
				/>
				<ul className="landing-truths border-border mt-[72px] border-b max-[599px]:mt-5 max-[599px]:border-b-0">
					{TRUTHS.map((truth) => (
						<li
							key={truth.key}
							id={'id' in truth ? truth.id : undefined}
							data-range={REVEAL_RANGE}
							className="landing-reveal border-border flex scroll-mt-6 flex-wrap items-baseline gap-x-10 gap-y-3 border-t py-[34px] max-[599px]:gap-y-2 max-[599px]:py-6"
						>
							<h3
								className={cn(
									'flex flex-[1_1_560px] items-center gap-5 text-[clamp(34px,4.2vw,58px)] max-[599px]:gap-3 max-[599px]:text-[26px]',
									DISPLAY,
									'max-[599px]:leading-[1.05]'
								)}
							>
								<LandingGlyph
									kind={truth.glyph}
									className="size-11 shrink-0 rounded-[12px] text-[22px] max-[599px]:size-7 max-[599px]:rounded-[8px] max-[599px]:text-base"
								/>
								{t(`${truth.key}Title`)}
							</h3>
							<p className="text-text-body max-w-[380px] flex-[1_1_300px]">
								{t(`${truth.key}Body`)}
							</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

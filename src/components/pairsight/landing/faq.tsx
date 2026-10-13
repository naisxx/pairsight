import { MIN_RECORDS } from '@/lib/pairsight/entity-types'
import { getTranslations } from 'next-intl/server'
import { EXACT_FORMATS } from '@/i18n/formats'
import { cn } from '@/lib/cn'
import { DISPLAY, Eyebrow, SECTION, WRAP } from './parts'

const QUESTIONS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const

// Asked and answered (pairsight-handoff Landing): the questions people ask
// first, the first one open. Plain <details>, so they open with no script.
export async function Faq() {
	const t = await getTranslations('HomePage')
	return (
		<section id="faq" aria-labelledby="faq-title" className={SECTION}>
			<div className={cn(WRAP, 'flex flex-wrap gap-x-24 gap-y-10 max-[599px]:gap-y-5')}>
				<div className="flex-[1_1_320px]">
					<div className="max-[599px]:hidden">
						<Eyebrow>{t('faqEyebrow')}</Eyebrow>
					</div>
					<h2
						id="faq-title"
						className={cn(
							'mt-5 text-[clamp(40px,4.6vw,68px)] max-[599px]:mt-0 max-[599px]:text-4xl',
							DISPLAY,
							'max-[599px]:leading-[1.05]'
						)}
					>
						{t('faqTitle')} <br />
						<span className="text-text-muted">{t('faqTitleAccent')}</span>
					</h2>
				</div>
				<div className="border-border min-w-0 flex-[2_1_560px] border-b max-[599px]:border-b-0">
					{QUESTIONS.map((key, index) => (
						<details key={key} open={index === 0} className="landing-faq border-border border-t">
							<summary className="landing-press hover:text-text-body font-display flex min-h-[76px] cursor-pointer items-center justify-between gap-4 text-2xl leading-[30px] font-semibold tracking-[-0.02em] max-[599px]:min-h-[60px] max-[599px]:gap-3 max-[599px]:text-xl">
								{t(`${key}Question`)}
								<span
									aria-hidden
									className="landing-faq-glyph bg-surface-muted inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] font-mono text-base font-semibold max-[599px]:size-7 max-[599px]:rounded-[8px]"
								>
									=
								</span>
							</summary>
							<p className="text-text-body max-w-[640px] pb-7 text-[19px] leading-[30px] max-[599px]:pb-5 max-[599px]:text-base max-[599px]:leading-6">
								{t(`${key}Answer`, { min: MIN_RECORDS }, EXACT_FORMATS)}
							</p>
						</details>
					))}
				</div>
			</div>
		</section>
	)
}

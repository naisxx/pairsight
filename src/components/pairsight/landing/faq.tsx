import { getTranslations } from 'next-intl/server'
import { ChevronDownIcon } from '@/components/ui/icons'
import { ScrollReveal } from './landing-motion'
import { ScrubHeading } from './scrub-heading'
import { SectionEyebrow, SplitSection } from './section-parts'

const QUESTIONS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const
const ICON_SIZE = 16

// Short answers to what people ask first. Native <details>, so each opens
// with the keyboard and without any script; the first starts open.
export async function Faq() {
	const t = await getTranslations('HomePage')
	return (
		<SplitSection
			id="faq"
			labelledBy="faq-title"
			aside={
				<>
					<SectionEyebrow>{t('faqEyebrow')}</SectionEyebrow>
					<ScrubHeading
						id="faq-title"
						lead={t('faqTitleLead')}
						accent={t('faqTitleAccent')}
						className="mt-3"
					/>
				</>
			}
		>
			<div className="divide-border border-border divide-y border-y">
				{QUESTIONS.map((key, index) => (
					<ScrollReveal key={key} index={index}>
						<details className="group" open={index === 0}>
							<summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold [&::-webkit-details-marker]:hidden">
								{t(`${key}Question`)}
								<ChevronDownIcon
									size={ICON_SIZE}
									className="text-text-muted shrink-0 transition-transform duration-200 group-open:rotate-180"
								/>
							</summary>
							<p className="text-text-muted -mt-1 pb-5 leading-relaxed">{t(`${key}Answer`)}</p>
						</details>
					</ScrollReveal>
				))}
			</div>
		</SplitSection>
	)
}

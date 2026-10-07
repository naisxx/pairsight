import { getTranslations } from 'next-intl/server'
import { ScrollReveal } from './landing-motion'
import { ScrubHeading } from './scrub-heading'
import { PointList, SectionEyebrow, SplitSection } from './section-parts'

const LIMITS = ['limit1', 'limit2', 'limit3', 'limit4'] as const
// The footer's "Your data" link lands on that point.
export const YOUR_DATA_ID = 'your-data'

// What PairSight's numbers do and don't mean, and what happens to your data.
export async function Honest() {
	const t = await getTranslations('HomePage')
	return (
		<SplitSection
			id="honest"
			labelledBy="honest-title"
			isTinted
			aside={
				<>
					<SectionEyebrow>{t('limitsEyebrow')}</SectionEyebrow>
					<ScrubHeading
						id="honest-title"
						lead={t('limitsTitleLead')}
						accent={t('limitsTitleAccent')}
						className="mt-3"
					/>
					<ScrollReveal>
						<p className="text-text-muted mt-5 max-w-md leading-relaxed">{t('limitsBody')}</p>
					</ScrollReveal>
				</>
			}
		>
			<PointList
				points={LIMITS.map((key) => ({
					key,
					id: key === 'limit4' ? YOUR_DATA_ID : undefined,
					title: t(`${key}Title`),
					body: t(`${key}Body`)
				}))}
			/>
		</SplitSection>
	)
}

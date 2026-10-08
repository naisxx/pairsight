import { getTranslations } from 'next-intl/server'
import { ScrubHeading } from './scrub-heading'
import { PointList, SectionEyebrow, SplitSection } from './section-parts'

const AUDIENCES = ['who1', 'who2', 'who3'] as const

// Who PairSight is for: whoever has to choose between matching vendors.
export async function Who() {
	const t = await getTranslations('HomePage')
	return (
		<SplitSection
			id="who"
			labelledBy="who-title"
			aside={
				<>
					<SectionEyebrow>{t('whoEyebrow')}</SectionEyebrow>
					<ScrubHeading
						id="who-title"
						lead={t('whoTitleLead')}
						accent={t('whoTitleAccent')}
						className="mt-3"
					/>
				</>
			}
		>
			<PointList
				points={AUDIENCES.map((key) => ({
					key,
					title: t(`${key}Title`),
					body: t(`${key}Body`)
				}))}
			/>
		</SplitSection>
	)
}

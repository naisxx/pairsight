import { getTranslations } from 'next-intl/server'
import { PlayIcon, SlidersIcon, TableIcon } from '@/components/ui/icons'
import { ScrollReveal } from './landing-motion'
import { ScrubHeading } from './scrub-heading'
import { SectionEyebrow } from './section-parts'

const ICON_SIZE = 20

const POINTS = [
	{ title: 'look1Title', body: 'look1Body', Icon: TableIcon },
	{ title: 'look2Title', body: 'look2Body', Icon: PlayIcon },
	{ title: 'look3Title', body: 'look3Body', Icon: SlidersIcon }
] as const

// "A closer look": what you get once a run is done, as three cards.
export async function CloserLook() {
	const t = await getTranslations('HomePage')
	return (
		<section
			id="look"
			aria-labelledby="look-title"
			className="bg-surface-muted/60 border-border border-y"
		>
			<div className="mx-auto max-w-[1200px] px-4 py-24 md:px-8 md:py-28">
				<SectionEyebrow>{t('lookEyebrow')}</SectionEyebrow>
				<ScrubHeading
					id="look-title"
					lead={t('lookTitleLead')}
					accent={t('lookTitleAccent')}
					className="mt-3 max-w-2xl"
				/>
				<ul className="mt-12 grid gap-4 md:grid-cols-3">
					{POINTS.map(({ title, body, Icon }, index) => (
						<ScrollReveal as="li" key={title} index={index}>
							<div className="border-border bg-surface h-full rounded-lg border p-6 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_40px_-20px_rgb(15_23_32/0.3)]">
								<span className="bg-surface-muted text-action grid size-10 place-items-center rounded-md">
									<Icon size={ICON_SIZE} />
								</span>
								<h3 className="mt-5 font-semibold">{t(title)}</h3>
								<p className="text-text-muted mt-2 text-sm leading-relaxed">{t(body)}</p>
							</div>
						</ScrollReveal>
					))}
				</ul>
			</div>
		</section>
	)
}

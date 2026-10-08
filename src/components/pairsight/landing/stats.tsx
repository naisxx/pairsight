import { getFormatter, getTranslations } from 'next-intl/server'
import type { LandingStats } from '@/server/pairsight/landing-demo'
import { ScrollReveal } from './landing-motion'

// The demos in three numbers, in coral: real counts from the recorded runs
// (landing-demo.ts), never rounded up for effect.
export async function StatBand({ stats }: { stats: LandingStats }) {
	const [t, format] = await Promise.all([getTranslations('HomePage'), getFormatter()])
	const items = [
		{ key: 'pairs', value: stats.pairsJudged, label: t('statPairsJudged') },
		{ key: 'records', value: stats.recordsPerDemo, label: t('statRecordsPerDemo') },
		{ key: 'types', value: stats.recordTypes, label: t('statRecordTypes') }
	]
	return (
		<section aria-label={t('statsLabel')} className="border-border border-y">
			<dl className="divide-border mx-auto grid max-w-[1200px] grid-cols-1 divide-y px-4 md:grid-cols-3 md:divide-x md:divide-y-0 md:px-8">
				{items.map((item, index) => (
					<ScrollReveal
						key={item.key}
						index={index}
						className="flex flex-col px-2 py-10 md:px-8 md:py-14 md:first:pl-0"
					>
						<dt className="text-text-muted type-ui order-2 mt-3 max-w-[16rem]">{item.label}</dt>
						<dd className="text-accent-ink font-mono text-5xl leading-none font-medium tracking-[-0.04em] md:text-6xl">
							{format.number(item.value, 'exact')}
						</dd>
					</ScrollReveal>
				))}
			</dl>
		</section>
	)
}

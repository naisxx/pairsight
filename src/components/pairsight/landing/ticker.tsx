import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import type { LandingPairName } from '@/server/pairsight/landing-demo'
import { LandingGlyph } from './parts'
import { TickerPause } from './ticker-pause'

// Two rows of pairs from the three demos with Jev's score (pairsight-handoff
// Landing, the ticker): the kind of pair PairSight puts in front of Jev, from
// sure to doubtful. The rows drift in opposite directions and stop under the
// pointer or the pause button. Each row is there twice, end to end, so the loop has no seam; a
// screen reader hears it once.
export async function Ticker({ rows }: { rows: [LandingPairName[], LandingPairName[]] }) {
	const t = await getTranslations('HomePage')
	return (
		<section
			aria-label={t('tickerLabel')}
			data-ticker
			className="landing-ticker bg-bg border-border relative overflow-hidden border-y py-[18px] max-[599px]:hidden"
		>
			{rows.map((row, index) => (
				<ul
					key={index}
					className={cn(
						'landing-ticker-row flex w-max py-1.5',
						index === 1 && 'landing-ticker-row-back mt-1.5'
					)}
				>
					{[false, true].flatMap((isCopy) =>
						row.map((pair) => (
							<li
								key={`${pair.key}-${isCopy}`}
								aria-hidden={isCopy || undefined}
								className="bg-surface border-border text-text mr-3 inline-flex min-h-11 items-center gap-3 rounded-[12px] border pr-4 pl-2 font-mono text-sm whitespace-nowrap"
							>
								<LandingGlyph kind={pair.isSame ? 'same' : 'different'} />
								{pair.a} <span className="text-text-muted">/</span> {pair.b}{' '}
								<strong>{pair.score.toFixed(2)}</strong>
							</li>
						))
					)}
				</ul>
			))}
			<TickerPause />
		</section>
	)
}

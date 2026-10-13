import { useTranslations } from 'next-intl'
import { SCORE_BANDS } from '@/lib/pairsight/decisions'
import { cn } from '@/lib/cn'

const PERCENT = 100
const TICKS = [0, 0.25, 0.5, 0.75, 1]
const at = (value: number) => `${value * PERCENT}%`

// The match cut-off on Jev's 0–1 scale (pairsight-handoff Setup), with where
// scores fell in our tests shaded in (SCORE_BANDS): clearly different records
// in vermilion at the low end, clearly the same in ice at the high end. An
// ink mark is the cut-off, so you can see why it sits safely between them,
// and how Lenient or Strict moves it. Drawn only: the value is said in words
// beside it wherever it's used.
export function CutoffScale({
	value,
	showLegend = true,
	className
}: {
	value: number
	// The two zones named under the scale; off where space is tight.
	showLegend?: boolean
	className?: string
}) {
	const t = useTranslations('CutoffScale')
	return (
		<div aria-hidden className={className}>
			<div className="bg-border relative h-2.5 rounded-full">
				<span
					className="bg-brand absolute inset-y-0 left-0 rounded-full"
					style={{ width: at(SCORE_BANDS.differentUpTo) }}
				/>
				<span
					className="bg-ice absolute inset-y-0 right-0 rounded-full"
					style={{ left: at(SCORE_BANDS.sameFrom) }}
				/>
				<span
					className="bg-text absolute -top-2 -ml-0.5 h-[26px] w-1 rounded-[2px] transition-[left] duration-200 ease-out"
					style={{ left: at(value) }}
				/>
			</div>
			<div className="text-text-muted relative mt-2.5 h-5 font-mono text-sm">
				{TICKS.map((tick) => (
					<span
						key={tick}
						className={cn(
							'absolute',
							tick === 0 ? 'left-0' : tick === 1 ? 'right-0' : '-translate-x-1/2'
						)}
						style={tick === 0 || tick === 1 ? undefined : { left: at(tick) }}
					>
						{tick === 0 || tick === 1 ? tick : tick.toFixed(2)}
					</span>
				))}
			</div>
			{showLegend && (
				<div className="text-text-body mt-4 flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm">
					<span className="flex items-center gap-2">
						<span className="bg-brand size-3 shrink-0 rounded-[3px]" />
						{t('different', { value: SCORE_BANDS.differentUpTo.toFixed(2) })}
					</span>
					<span className="flex items-center gap-2">
						<span className="bg-ice size-3 shrink-0 rounded-[3px]" />
						{t('same', { value: SCORE_BANDS.sameFrom.toFixed(2) })}
					</span>
				</div>
			)}
		</div>
	)
}

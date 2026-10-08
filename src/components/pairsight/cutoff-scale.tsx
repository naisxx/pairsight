import { useTranslations } from 'next-intl'
import { SCORE_BANDS } from '@/lib/pairsight/decisions'
import { cn } from '@/lib/cn'

const PERCENT = 100
const TICKS = [0, 0.25, 0.5, 0.75, 1]
const at = (value: number) => `${value * PERCENT}%`

// The match cut-off on Jev's 0–1 scale, with where scores fell in our tests
// shaded in (SCORE_BANDS): clearly different records at the low end, true
// matches at the high end. A coral pin carries the value, so you can see why
// a cut-off sits safely between them, and how Lenient or Strict moves it.
// Drawn only: the value is said in words beside it wherever it's used.
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
		<div aria-hidden className={cn('pt-7', className)}>
			<div className="relative">
				{/* The pin: the value in a coral tag, pointing at the line. */}
				<span
					className="absolute bottom-full mb-1.5 -translate-x-1/2 transition-[left] duration-300 ease-out"
					style={{ left: at(value) }}
				>
					<span className="bg-action text-action-ink block rounded-full px-2 py-0.5 font-mono text-[0.6875rem] leading-4 font-medium">
						{value.toFixed(2)}
					</span>
					<span className="border-t-action mx-auto block size-0 border-x-4 border-t-4 border-x-transparent" />
				</span>
				<div className="bg-border relative h-2.5 overflow-hidden rounded-full">
					<span
						className="bg-text-muted/40 absolute inset-y-0 left-0"
						style={{ width: at(SCORE_BANDS.differentUpTo) }}
					/>
					<span
						className="bg-action/45 absolute inset-y-0 right-0"
						style={{ left: at(SCORE_BANDS.sameFrom) }}
					/>
				</div>
				<span
					className="bg-action absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full transition-[left] duration-300 ease-out"
					style={{ left: at(value) }}
				/>
			</div>
			<div className="text-text-muted relative mt-1.5 h-4 font-mono text-[0.6875rem]">
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
				<div className="mt-2 flex justify-between gap-4 text-xs">
					<span className="flex items-center gap-1.5">
						<span className="bg-text-muted/40 size-2.5 shrink-0 rounded-[3px]" />
						<span className="text-text-muted">
							{t('different', { value: SCORE_BANDS.differentUpTo.toFixed(2) })}
						</span>
					</span>
					<span className="flex items-center gap-1.5 text-right">
						<span className="bg-action/45 size-2.5 shrink-0 rounded-[3px]" />
						<span className="text-text-muted">
							{t('same', { value: SCORE_BANDS.sameFrom.toFixed(2) })}
						</span>
					</span>
				</div>
			)}
		</div>
	)
}

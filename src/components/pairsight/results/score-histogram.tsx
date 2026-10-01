import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'

const BINS = 20
// A bin with any pairs stays visible next to a much taller one.
const MIN_BAR_PERCENT = 4

export type JudgedScore = { score: number; isVendorMatch: boolean }

// How Jev's scores spread across 0–1, in 0.05-wide bars, with the threshold
// as a line: it shows how many pairs sit near the line and would change with
// it. Bars that reach past the threshold are drawn dark (the bar holding the
// threshold counts as reaching past it); the summary line gives exact counts. Drawn with plain
// elements (no chart library); screen readers get the same numbers as a table.
export function ScoreHistogram({
	scores,
	threshold
}: {
	scores: JudgedScore[]
	threshold: number
}) {
	const t = useTranslations('Results')
	const bins = Array.from({ length: BINS }, () => 0)
	for (const { score } of scores) {
		const bin = Math.min(BINS - 1, Math.floor(score * BINS))
		bins[bin] = (bins[bin] ?? 0) + 1
	}
	const tallest = Math.max(1, ...bins)
	const above = scores.filter(({ score }) => score >= threshold).length
	const range = (index: number) => `${(index / BINS).toFixed(2)}–${((index + 1) / BINS).toFixed(2)}`

	return (
		<figure className="flex flex-col gap-1.5">
			<figcaption className="text-text-muted type-meta">
				{t('distributionSummary', {
					above,
					below: scores.length - above,
					threshold: threshold.toFixed(2)
				})}
			</figcaption>
			<div aria-hidden className="relative">
				<div className="border-border flex h-24 items-end gap-px border-b">
					{bins.map((count, index) => (
						<span
							key={index}
							className={cn(
								'block flex-1 rounded-t-[2px]',
								(index + 1) / BINS > threshold ? 'bg-text' : 'bg-text-muted/35'
							)}
							style={{
								height: count === 0 ? 0 : `${Math.max(MIN_BAR_PERCENT, (count / tallest) * 100)}%`
							}}
						/>
					))}
				</div>
				<span
					className="bg-action absolute -top-1 bottom-0 w-0.5 rounded-full"
					style={{ left: `calc(${threshold * 100}% - 1px)` }}
				/>
				<div className="text-text-muted type-data-sm mt-1 flex justify-between">
					<span>0</span>
					<span>0.5</span>
					<span>1</span>
				</div>
			</div>
			<table className="sr-only">
				<caption>{t('distributionTitle')}</caption>
				<thead>
					<tr>
						<th scope="col">{t('distributionRange')}</th>
						<th scope="col">{t('distributionPairs')}</th>
					</tr>
				</thead>
				<tbody>
					{bins.flatMap((count, index) =>
						count === 0
							? []
							: [
									<tr key={index}>
										<td>{range(index)}</td>
										<td>{count}</td>
									</tr>
								]
					)}
				</tbody>
			</table>
		</figure>
	)
}

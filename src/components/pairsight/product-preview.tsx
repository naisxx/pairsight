import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { CategoryBadge, CategoryDot, CATEGORY_STYLES, ScoreBar } from './result-parts'
import { LogoGlyph } from './wordmark'

// A still picture of the Results screen on fictional data, for the empty
// dashboard. Purely illustrative: the screen reader hears one sentence, not
// the miniature UI. Its parts arrive in reading order (motion.css, .rise).

const STAGES = ['records', 'vendors', 'rules', 'plan', 'results'] as const
const PREVIEW_THRESHOLD = 0.6
const PREVIEW_BAR_WIDTH = 40
// 12 both matched, 4 PairSight only, 3 vendor only: precision 80.0%,
// recall 75.0%, F1 77.4%.
const METRICS = [
	{ key: 'precision', value: '80.0%' },
	{ key: 'recall', value: '75.0%' },
	{ key: 'f1', value: '77.4%' }
] as const
const COUNTS = [
	{ category: 'both_matched', count: 12 },
	{ category: 'pairsight_only', count: 4 },
	{ category: 'vendor_only', count: 3 },
	{ category: 'neither_matched', count: 21 }
] as const
const ROWS = [
	{
		category: 'pairsight_only',
		a: 'C-1042',
		aName: 'Mara Ilves',
		b: 'C-2210',
		bName: 'Mara Ilves-Kask',
		score: 0.82
	},
	{
		category: 'vendor_only',
		a: 'C-1187',
		aName: 'Tomas Reyna',
		b: 'C-1188',
		bName: 'Tomás Reyna',
		score: 0.31
	},
	{
		category: 'pairsight_only',
		a: 'C-1305',
		aName: 'Priya Nandakumar',
		b: 'C-3120',
		bName: 'P. Nandakumar',
		score: 0.74
	},
	{
		category: 'vendor_only',
		a: 'C-1411',
		aName: 'Jon Halvorsen',
		b: 'C-1417',
		bName: 'Jonas Halvorsen',
		score: 0.22
	},
	{
		category: 'pairsight_only',
		a: 'C-1590',
		aName: 'Lea Okafor',
		b: 'C-2904',
		bName: 'Leah Okafor',
		score: 0.69
	}
] as const

export function ProductPreview() {
	const t = useTranslations('ProductPreview')
	const tCat = useTranslations('Categories')
	const tSteps = useTranslations('Steps')
	return (
		<div
			role="img"
			aria-label={t('label', {
				precision: METRICS[0].value,
				recall: METRICS[1].value,
				f1: METRICS[2].value
			})}
			className="border-border bg-bg shadow-elevated overflow-hidden rounded-lg border"
		>
			<div className="flex" aria-hidden>
				<div className="border-border bg-surface hidden w-[150px] shrink-0 border-r p-3 sm:block">
					<div className="flex items-center gap-1.5">
						<LogoGlyph className="h-3 w-4" />
						<span className="text-[11px] font-semibold">{t('app')}</span>
					</div>
					<p className="text-text-muted mt-4 text-[9px]">{t('currentEvaluation')}</p>
					<ul className="mt-1.5 space-y-1">
						{STAGES.map((stage) => (
							<li
								key={stage}
								className={cn(
									'flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-[10px]',
									stage === 'results' && 'bg-surface-hover shadow-[inset_2px_0_0_var(--action)]'
								)}
							>
								<span className="bg-text text-surface flex size-3 items-center justify-center rounded-full text-[7px]">
									✓
								</span>
								{tSteps(stage)}
							</li>
						))}
					</ul>
				</div>
				<div className="min-w-0 flex-1 p-4">
					<p className="type-ui font-semibold">{t('title')}</p>
					<p className="text-text-muted text-[9px]">
						{t.rich('meta', {
							threshold: PREVIEW_THRESHOLD.toFixed(2),
							n: (chunks) => <span className="font-mono">{chunks}</span>
						})}
					</p>
					<div className="border-border divide-border bg-surface mt-3 grid grid-cols-3 divide-x rounded-[6px] border">
						{METRICS.map((metric, index) => (
							<div key={metric.key} className={`rise stagger-${index} px-3 py-2`}>
								<p className="text-text-muted text-[9px]">{t(metric.key)}</p>
								<p className="font-mono text-[17px] font-medium">{metric.value}</p>
							</div>
						))}
					</div>
					<div className="mt-2 grid grid-cols-4 gap-1.5">
						{COUNTS.map(({ category, count }, index) => {
							const isDisagreement = category === 'pairsight_only' || category === 'vendor_only'
							return (
								<div
									key={category}
									className={cn(
										`rise stagger-${METRICS.length + index} border-border rounded-[6px] border p-2`,
										isDisagreement ? CATEGORY_STYLES[category].badge : 'bg-surface'
									)}
								>
									<p className="text-text flex items-center gap-1 text-[9px]">
										<CategoryDot category={category} className="size-1.5" />
										{tCat(category)}
									</p>
									<p className="font-mono text-[15px] font-medium">{count}</p>
								</div>
							)
						})}
					</div>
					<div className="border-border bg-surface mt-2 overflow-hidden rounded-[6px] border">
						{ROWS.map((row, index) => (
							<div
								key={row.a}
								className={`rise stagger-${METRICS.length + COUNTS.length + index} border-border flex items-center gap-3 border-b px-2.5 py-1.5 text-[10px] last:border-0`}
							>
								<span className="w-[92px] shrink-0 origin-left scale-[0.8]">
									<CategoryBadge category={row.category} />
								</span>
								<span className="min-w-0 flex-1 truncate">
									<span className="text-text-muted font-mono">{row.a}</span> {row.aName}
								</span>
								<span className="hidden min-w-0 flex-1 truncate md:block">
									<span className="text-text-muted font-mono">{row.b}</span> {row.bName}
								</span>
								<ScoreBar
									score={row.score}
									threshold={PREVIEW_THRESHOLD}
									width={PREVIEW_BAR_WIDTH}
									className="text-[10px]"
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

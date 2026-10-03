import { useTranslations } from 'next-intl'
import { CheckIcon, CsvFileIcon, MinusIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { CategoryBadge, ScoreBar } from '../result-parts'

// The three "How it works" illustrations: small, fictional compositions of
// the real parts (file cards, rule chips, score bars, category badges), so
// they look like the product. Purely illustrative, so screen readers skip
// them: the step's own text says the same. Layers carry parallax depths
// (motion.css, .parallax / .depth-*), so they drift apart as you scroll.

const ICON_SIZE = 18
const SMALL_ICON = 12
const SCORE_BAR_WIDTH = 64
const THRESHOLD = 0.5

const panel =
	'border-border bg-surface absolute rounded-md border shadow-[0_8px_24px_rgb(15_23_32/0.08)]'

export function DataVisual() {
	const t = useTranslations('HomePage')
	const files = [
		{
			name: 'customers.csv',
			meta: t('visualRows', { count: 24 }),
			depth: 'depth-back',
			at: 'left-[6%] top-[14%] rotate-[-4deg]'
		},
		{
			name: 'vendor-a.csv',
			meta: t('visualPair'),
			depth: 'depth-1',
			at: 'left-[24%] top-[38%] rotate-[2deg]'
		},
		{
			name: 'vendor-b.csv',
			meta: t('visualGroup'),
			depth: 'depth-3',
			at: 'left-[44%] top-[16%] rotate-[-1deg]'
		}
	]
	return (
		<div aria-hidden className="relative h-40 overflow-hidden">
			{files.map((file) => (
				<div
					key={file.name}
					className={cn(panel, 'parallax flex items-center gap-2 px-3 py-2', file.depth, file.at)}
				>
					<CsvFileIcon size={ICON_SIZE} className="text-text-muted" />
					<span>
						<span className="block font-mono text-[11px]">{file.name}</span>
						<span className="text-text-muted block text-[10px]">{file.meta}</span>
					</span>
				</div>
			))}
		</div>
	)
}

export function RulesVisual() {
	const t = useTranslations('HomePage')
	return (
		<div aria-hidden className="relative h-40 overflow-hidden">
			<div className={cn(panel, 'parallax depth-back top-[12%] left-[6%] px-3 py-2')}>
				<span className="text-text-muted block font-mono text-[10px]">R01</span>
				<span className="block text-[11px] font-medium">Jane Smith</span>
				<span className="text-text-muted block font-mono text-[10px]">jane@mail.test</span>
			</div>
			<div className={cn(panel, 'parallax depth-back top-[50%] left-[10%] px-3 py-2')}>
				<span className="text-text-muted block font-mono text-[10px]">R03</span>
				<span className="block text-[11px] font-medium">Jane Smyth</span>
				<span className="text-text-muted block font-mono text-[10px]">jane@mail.test</span>
			</div>
			<ul className="parallax depth-2 absolute top-[16%] left-[50%] space-y-1.5">
				<li className="bg-accent text-accent-ink flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
					<CheckIcon size={SMALL_ICON} /> {t('visualSameEmail')}
				</li>
				<li className="border-border bg-surface text-text-muted flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
					<MinusIcon size={SMALL_ICON} /> {t('visualSamePhone')}
				</li>
			</ul>
			<div className={cn(panel, 'parallax depth-3 top-[60%] left-[48%] px-3 py-2')}>
				<span className="text-text-muted block text-[10px]">{t('visualThreshold')}</span>
				<span className="font-mono text-[13px] font-medium">0.50</span>{' '}
				<span className="text-text-muted text-[10px]">{t('visualBalanced')}</span>
			</div>
		</div>
	)
}

export function VerdictVisual() {
	const t = useTranslations('HomePage')
	return (
		<div aria-hidden className="relative h-40 overflow-hidden">
			<div className={cn(panel, 'parallax depth-back top-[10%] left-[6%] px-3 py-2.5')}>
				<span className="text-text-muted block text-[10px]">{t('visualJev')}</span>
				<ScoreBar
					score={0.92}
					threshold={THRESHOLD}
					width={SCORE_BAR_WIDTH}
					className="text-[11px]"
				/>
				<span className="mt-1 block text-[11px] font-semibold">{t('visualMatch')}</span>
			</div>
			<ul
				className={cn(
					panel,
					'parallax depth-2 top-[16%] left-[46%] space-y-1 px-3 py-2 text-[10px]'
				)}
			>
				<li className="flex items-center gap-1.5">
					<CheckIcon size={SMALL_ICON} /> {t('visualVendorA')}
				</li>
				<li className="text-text-muted flex items-center gap-1.5">
					<MinusIcon size={SMALL_ICON} /> {t('visualVendorB')}
				</li>
			</ul>
			<div className="parallax depth-3 absolute top-[66%] left-[30%] origin-left scale-90">
				<CategoryBadge category="pairsight_only" />
			</div>
		</div>
	)
}

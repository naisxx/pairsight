import { formatNoteKind } from '@/lib/pairsight/format-note'
import { getTranslations } from 'next-intl/server'
import { Count } from '@/components/ui/count'
import { EXACT_FORMATS } from '@/i18n/formats'
import { cn } from '@/lib/cn'
import { isPairsightMatch } from '@/lib/pairsight/decisions'
import type { LandingDemo, LandingField } from '@/server/pairsight/landing-demo'
import { DISPLAY, Eyebrow, LandingGlyph, SECTION, SectionTitle, WRAP } from './parts'

// The Narrow scene's dots, on a 22px grid: the pairs PairSight suggests
// (vermilion) and the ones a vendor's match adds (ice). Placed by the design.
const DOT_STEP = 22
const SUGGESTED_DOTS = [
	[2, 1],
	[5, 3],
	[9, 2],
	[13, 1],
	[17, 4],
	[3, 6],
	[7, 8],
	[11, 5],
	[15, 7],
	[18, 10],
	[1, 11],
	[6, 12],
	[10, 10],
	[14, 12],
	[4, 9],
	[12, 8],
	[16, 2],
	[8, 5]
] as const
const ADDED_DOTS = [
	[88, 110],
	[220, 44],
	[308, 198],
	[176, 242],
	[374, 110]
] as const
// The Blind scene's three bars the record passes through.
const PILLARS = [170, 230, 290]
// A floating label, as in the hero (the design's `.chf`).
const CHIP =
	'bg-surface border-border landing-shadow absolute inline-flex min-h-10 items-center gap-2.5 rounded-[12px] border pr-3.5 pl-2 font-mono text-[0.8125rem] whitespace-nowrap'
// What's taken off before Jev sees the pair: shrunk, faded and struck out.
const STRUCK = 'origin-left scale-90 opacity-40 blur-[1px] line-through'

// The phone's three steps (messages: HomePage phoneStep1..3).
const PHONE_STEPS = ['phoneStep1', 'phoneStep2', 'phoneStep3'] as const

// Pinned, each part plays over a stretch of the walkthrough's scroll, as a
// share of it (pairsight-handoff Landing: `contain X% contain Y%` on --st).
const along = (from: number, to: number) => `contain ${from}% contain ${to}%`
// The Narrow scene's dots light one by one, 0.8% of the scroll apart.
const DOT_FIRST = 10
const DOT_SPAN = 4
const DOT_STEP_PERCENT = 0.8
// Open's six rows rise one at a time, 2.7% apart.
const ROW_FIRST = 77
const ROW_SPAN = 4
const ROW_STEP_PERCENT = 2.7
// Loose tiles and outlines that drift past at their own speeds while the
// walkthrough is pinned, for depth: where they sit, how they look, and how
// far they travel (--a down to minus --a) over the whole section.
const DEPTH_TILES = [
	{ place: 'left-[-9%] top-[18%] size-12 bg-brand opacity-50', travel: 520 },
	{ place: 'left-[46%] top-[70%] size-7 bg-ice opacity-70', travel: 900 },
	{ place: 'right-[-3%] top-[8%] size-[120px] border-[1.5px] border-border', travel: 260 },
	{ place: 'left-[38%] top-[6%] size-[18px] bg-text-muted', travel: 1300 },
	{ place: 'right-[8%] top-[84%] size-11 bg-ice opacity-35 blur-[3px]', travel: 380 },
	{ place: 'left-[20%] top-[88%] size-[90px] border-[1.5px] border-border blur-[1px]', travel: 180 }
]

function glyphOf(field: LandingField): 'same' | 'different' | 'missing' {
	return field.comparison === 'same'
		? 'same'
		: field.comparison === 'different'
			? 'different'
			: 'missing'
}

function Scene({
	step,
	title,
	body,
	children
}: {
	step: number
	title: string
	body: string
	children: React.ReactNode
}) {
	return (
		<li
			data-range={along(0, 100)}
			data-timeline="story"
			className={`landing-scene landing-scene-${step} flex flex-wrap items-center gap-x-[72px] gap-y-10`}
		>
			<div className="landing-scene-text min-w-0 flex-[1_1_380px]">
				<p className="text-brand-text font-mono text-[19px] leading-[30px] tracking-[0.06em]">
					{String(step).padStart(2, '0')} / 03
				</p>
				<h3
					className={cn(
						'text-text-body mt-3.5 text-[clamp(72px,9vw,136px)]',
						DISPLAY,
						'leading-[0.92]'
					)}
				>
					{title}
				</h3>
				<p className="text-text-body mt-5 max-w-[420px] text-[19px] leading-[30px]">{body}</p>
			</div>
			<div aria-hidden className="relative min-h-[520px] min-w-0 flex-[1_1_440px]">
				{children}
			</div>
		</li>
	)
}

// How it works (pairsight-handoff Landing, the walkthrough): Narrow, Blind,
// Open, with the demo's own pair. With motion on a wide screen it pins for
// 6,200px of scroll and the three scenes play in turn (landing.css,
// scroll-scene.ts); otherwise they stack, each in its finished state.
export async function Walkthrough({ demo }: { demo: LandingDemo }) {
	const [t, tRoles, tPair] = await Promise.all([
		getTranslations('HomePage'),
		getTranslations('Roles'),
		getTranslations('Pair')
	])
	const { story } = demo
	// The vendor whose decision is struck off: one that said different.
	const differed = story.said.find((vendor) => !vendor.isSame) ?? story.said[0]

	return (
		<section
			id="how"
			aria-labelledby="how-title"
			className={cn(SECTION, 'bg-surface-muted/74 max-[599px]:bg-surface-muted')}
		>
			<div className={WRAP}>
				<Eyebrow glyph="same">{t('howEyebrow')}</Eyebrow>
				<SectionTitle id="how-title" lead={t('howTitle')} accent={t('howTitleAccent')} />
				{/* A phone gets the three steps in words (pairsight-handoff Phone). */}
				<ol className="mt-7 min-[600px]:hidden">
					{PHONE_STEPS.map((key, index) => (
						<li key={key} className="border-border border-t py-6">
							<p className="text-brand-text font-mono text-[0.8125rem] leading-[18px] tracking-[0.06em]">
								{String(index + 1).padStart(2, '0')} / 03
							</p>
							<h3 className={cn('mt-2 text-[56px]', DISPLAY, 'leading-[1.05]')}>
								{t(`${key}Title`)}
							</h3>
							<p className="text-text-body mt-2.5">
								{t(
									`${key}Body`,
									{ suggested: demo.suggested, added: demo.addedByVendors },
									EXACT_FORMATS
								)}
							</p>
						</li>
					))}
				</ol>
				<a
					href="#after"
					className="landing-press text-text-body decoration-border-strong hover:decoration-text hover:text-text mt-5 inline-flex min-h-11 items-center underline underline-offset-[3px] transition-[text-decoration-color] duration-150 max-[599px]:hidden"
				>
					{t('skipWalkthrough')}
				</a>
				<div
					id="inside"
					data-timeline-subject="story"
					className="landing-story mt-[88px] max-[599px]:hidden"
				>
					<div className="landing-pin">
						{DEPTH_TILES.map((tile) => (
							<i
								key={tile.place}
								aria-hidden
								data-range="cover 0% cover 100%"
								data-timeline="story"
								className={cn('landing-depth absolute rounded-[10px]', tile.place)}
								style={{ '--a': `${tile.travel}px`, '--b': `${-tile.travel}px` }}
							/>
						))}
						<div aria-hidden className="landing-rail">
							<i data-range={along(0, 100)} data-timeline="story" />
						</div>
						<ol aria-label={t('walkthroughLabel')} className="landing-scenes flex flex-col gap-24">
							<Scene
								step={1}
								title={t('narrowTitle')}
								body={t(
									'narrowBody',
									{
										records: demo.recordCount,
										possible: demo.possiblePairs,
										suggested: demo.suggested,
										added: demo.addedByVendors,
										checked: demo.checked
									},
									EXACT_FORMATS
								)}
							>
								{/* Two layers of every possible pair, zooming past as it narrows. */}
								<span
									data-range={along(1, 16)}
									data-timeline="story"
									className="landing-haze landing-haze-far"
								/>
								<span
									data-range={along(8, 26)}
									data-timeline="story"
									className="landing-haze landing-haze-mid"
								/>
								<div className="relative mx-auto mt-[60px] h-[308px] w-[440px] max-w-full">
									{SUGGESTED_DOTS.map(([x, y], index) => (
										<span
											key={`${x}-${y}`}
											data-range={along(
												DOT_FIRST + index * DOT_STEP_PERCENT,
												DOT_FIRST + DOT_SPAN + index * DOT_STEP_PERCENT
											)}
											data-timeline="story"
											className="landing-dot bg-brand absolute m-1 size-3.5 rounded-full"
											style={{ left: x * DOT_STEP, top: y * DOT_STEP }}
										/>
									))}
									{ADDED_DOTS.map(([left, top]) => (
										<span
											key={`${left}-${top}`}
											data-range={along(22, 29)}
											data-timeline="story"
											className="landing-added bg-ice absolute m-1 size-3.5 rounded-full"
											style={{ left, top }}
										/>
									))}
								</div>
								<p className="absolute bottom-6 left-0">
									{/* Counts down from every possible pair to the ones checked. */}
									<span
										data-range={along(2, 27)}
										data-timeline="story"
										data-count-from={demo.possiblePairs}
										data-count-to={demo.checked}
										className="block font-mono text-[56px] leading-none font-semibold tracking-[-0.04em]"
									>
										<Count value={demo.checked} />
									</span>
									<span className="text-text-muted mt-1.5 block text-sm">{t('narrowCount')}</span>
								</p>
							</Scene>

							<Scene step={2} title={t('blindTitle')} body={t('blindBody')}>
								{PILLARS.map((left) => (
									<span key={left} className="landing-pillar absolute top-10" style={{ left }} />
								))}
								<span
									data-range={along(34, 66)}
									data-timeline="story"
									className={cn(CHIP, STRUCK, 'landing-strike-1 top-[150px] left-0 pl-3.5')}
								>
									{differed?.name}
								</span>
								<span
									data-range={along(34, 66)}
									data-timeline="story"
									className={cn(CHIP, STRUCK, 'landing-strike-2 top-[108px] left-0')}
								>
									<LandingGlyph kind="different" />
									{t('blindDifferent')}
								</span>
								<span
									data-range={along(34, 66)}
									data-timeline="story"
									className={cn(CHIP, STRUCK, 'landing-strike-3 top-[66px] left-0 pl-3.5')}
								>
									{story.refs[0]}
								</span>
								<div
									data-range={along(34, 66)}
									data-timeline="story"
									className="landing-carry bg-surface border-border landing-shadow absolute top-[200px] left-0 w-40 translate-x-[320px] rounded-[16px] border px-4 py-3.5 font-mono text-[0.8125rem]"
								>
									{story.card.map((value) => (
										<p key={value.role} className="mt-2 first:mt-0">
											<span className="text-text-muted block font-sans text-xs">
												{tRoles(value.role)}
											</span>
											{value.value}
										</p>
									))}
								</div>
								<div className="bg-inverse text-on-inverse absolute top-[206px] right-0 flex w-16 flex-col items-center gap-1.5 rounded-[16px] py-3.5">
									<span className="font-mono text-[0.8125rem] tracking-[0.06em] uppercase opacity-70">
										{t('jev')}
									</span>
									<strong
										data-range={along(61, 65)}
										data-timeline="story"
										className="landing-pop inline-block font-mono"
									>
										{story.score.toFixed(2)}
									</strong>
								</div>
							</Scene>

							<Scene step={3} title={t('openTitle')} body={t('openBody')}>
								{(['A', 'B'] as const).map((side, index) => (
									<div
										key={side}
										data-range={along(67, 77)}
										data-timeline="story"
										className={cn(
											'bg-surface border-border landing-shadow absolute top-0 h-[400px] w-[calc(50%-30px)] rounded-[20px] border px-5 py-[18px]',
											index === 0 ? 'landing-dock-a left-0' : 'landing-dock-b right-0'
										)}
									>
										<p
											className={cn(
												'font-mono text-[0.8125rem] leading-[18px] tracking-[0.06em] uppercase',
												index === 0 ? 'text-brand-text' : 'text-ice-text text-right'
											)}
										>
											{t('openRecord', { side, ref: story.refs[index] ?? '' })}
										</p>
									</div>
								))}
								<div className="absolute inset-x-0 top-[54px]">
									{story.fields.map((field, index) => {
										const differs = field.comparison === 'different' || field.isFormatOnly
										return (
											<div
												key={field.role}
												data-range={along(
													ROW_FIRST + index * ROW_STEP_PERCENT,
													ROW_FIRST + ROW_SPAN + index * ROW_STEP_PERCENT
												)}
												data-timeline="story"
												className="landing-row grid h-14 grid-cols-[minmax(0,1fr)_60px_minmax(0,1fr)] items-center font-mono text-[0.8125rem]"
											>
												<span className="truncate px-5">
													<small className="text-text-muted block font-sans text-[11px]">
														{tRoles(field.role)}
													</small>
													<FieldValue value={field.a} missing={tPair('missing')} />
												</span>
												<LandingGlyph
													kind={glyphOf(field)}
													className="bg-surface-muted mx-auto size-[34px] rounded-[10px]"
												/>
												<span className="truncate px-5 text-right">
													<small className="text-text-muted block font-sans text-[11px]">
														{field.isFormatOnly
															? tPair('formatNote', { kind: formatNoteKind(field.a, field.b) })
															: ' '}
													</small>
													<FieldValue
														value={field.b}
														missing={tPair('missing')}
														isDifferent={differs}
													/>
												</span>
											</div>
										)
									})}
								</div>
								<div
									data-range={along(94, 99)}
									data-timeline="story"
									className="landing-verdict bg-inverse text-on-inverse absolute inset-x-0 top-[416px] flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] px-[22px] py-4 text-[15px]"
								>
									<span className="font-mono text-4xl font-semibold">{story.score.toFixed(2)}</span>
									<span className="flex-[1_1_160px]">
										{t.rich('openJevSays', {
											same: String(
												isPairsightMatch({ score: story.score, threshold: demo.threshold })
											),
											b: (chunks) => <strong>{chunks}</strong>
										})}
									</span>
									{story.said.map((vendor) => (
										<span key={vendor.name}>
											{t.rich('openVendorSays', {
												vendor: vendor.name,
												same: String(vendor.isSame),
												b: (chunks) => (
													<strong className={vendor.isSame ? undefined : 'text-inverse-brand'}>
														{chunks}
													</strong>
												)
											})}
										</span>
									))}
								</div>
							</Scene>
						</ol>
					</div>
				</div>
			</div>
		</section>
	)
}

function FieldValue({
	value,
	missing,
	isDifferent = false
}: {
	value: string
	missing: string
	isDifferent?: boolean
}) {
	if (value.trim() === '') {
		return <span className="text-text-muted font-sans italic">{missing}</span>
	}
	return <span className={isDifferent ? 'landing-diff' : undefined}>{value}</span>
}

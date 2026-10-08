'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { m, useMotionValueEvent, useScroll } from 'motion/react'
import { CheckIcon, CsvFileIcon, MinusIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { categorize } from '@/lib/pairsight/decisions'
import type { LandingDemo, LandingPair } from '@/server/pairsight/landing-demo'
import { CategoryBadge, ScoreBar } from '../result-parts'
import { EASE, ScrollReveal } from './landing-motion'
import { STORY_PAIR } from './sections'

const STEPS = [
	{ title: 'step1Title', body: 'step1Body' },
	{ title: 'step2Title', body: 'step2Body' },
	{ title: 'step3Title', body: 'step3Body' }
] as const
const STEP_COUNT = STEPS.length
// Just under 1, so the very end of the section still reads as the last step.
const LAST_PROGRESS = 0.999
const STAGE_S = 0.5
const STAGE_SHIFT_PX = 18
const ICON_SIZE = 18
const CHIP_ICON_SIZE = 12

// "How it works" as a story about one real pair from the demo. On a wide
// screen it pins while you scroll: the steps on the left take turns, and the
// stage on the right follows the pair from the files, through the rules, to
// the verdict. On a narrow screen, or with reduced motion, it's a plain list
// with the same three pictures.
export function Story({ demo }: { demo: LandingDemo }) {
	const t = useTranslations('HomePage')
	const pair = demo.examples.find((candidate) => candidate.key === STORY_PAIR)
	if (pair == null) return null
	const intro = (
		<>
			<p className="type-ui text-action font-semibold">{t('howEyebrow')}</p>
			<h2 className="type-display-md mt-3">{t('howTitle')}</h2>
			<p className="text-text-muted mt-4 max-w-lg leading-relaxed">{t('howBody')}</p>
		</>
	)
	return (
		<section id="how" aria-label={t('howEyebrow')}>
			<PinnedStory demo={demo} pair={pair} intro={intro} />
			<div className="mx-auto max-w-[1200px] px-4 py-20 motion-reduce:block min-[900px]:hidden md:px-8">
				<ScrollReveal>{intro}</ScrollReveal>
				<ol className="mt-10 space-y-10">
					{STEPS.map((step, index) => (
						<ScrollReveal as="li" key={step.title} index={index}>
							<StepText index={index} isActive />
							<div className="border-border bg-surface-muted/50 relative mt-4 h-64 overflow-hidden rounded-lg border">
								<StageLayer step={index} demo={demo} pair={pair} isShown />
							</div>
						</ScrollReveal>
					))}
				</ol>
			</div>
		</section>
	)
}

function PinnedStory({
	demo,
	pair,
	intro
}: {
	demo: LandingDemo
	pair: LandingPair
	intro: React.ReactNode
}) {
	const t = useTranslations('HomePage')
	const target = useRef<HTMLDivElement>(null)
	const { scrollYProgress } = useScroll({ target, offset: ['start start', 'end end'] })
	const [step, setStep] = useState(0)
	useMotionValueEvent(scrollYProgress, 'change', (progress) => {
		setStep(Math.floor(Math.min(progress, LAST_PROGRESS) * STEP_COUNT))
	})
	return (
		<div ref={target} className="hidden h-[320vh] motion-reduce:hidden min-[900px]:block">
			<div className="sticky top-0 flex h-dvh items-center">
				<div className="mx-auto grid w-full max-w-[1200px] grid-cols-12 items-center gap-10 px-8">
					<div className="col-span-5">
						{intro}
						<ol className="relative mt-10 space-y-2" aria-label={t('howSteps')}>
							<span aria-hidden className="bg-border absolute top-2 bottom-2 left-[15px] w-px" />
							<m.span
								aria-hidden
								className="bg-action absolute top-2 bottom-2 left-[15px] w-px origin-top"
								style={{ scaleY: scrollYProgress }}
							/>
							{STEPS.map((stepCopy, index) => (
								<li key={stepCopy.title} aria-current={index === step ? 'step' : undefined}>
									<StepText index={index} isActive={index === step} />
								</li>
							))}
						</ol>
					</div>
					<div
						aria-hidden
						className="border-border bg-surface relative col-span-7 h-[460px] overflow-hidden rounded-lg border shadow-[0_24px_60px_-24px_rgb(15_23_32/0.28)]"
					>
						<div className="stage-grid absolute inset-0" />
						{STEPS.map((stepCopy, index) => (
							<StageLayer
								key={stepCopy.title}
								step={index}
								demo={demo}
								pair={pair}
								isShown={index === step}
								isAnimated
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

function StepText({ index, isActive }: { index: number; isActive: boolean }) {
	const t = useTranslations('HomePage')
	const step = STEPS[index]
	if (step == null) return null
	return (
		<div className="relative flex gap-4 rounded-md py-2 pr-2">
			<span
				className={cn(
					'bg-surface relative grid size-8 shrink-0 place-items-center rounded-full border font-mono text-xs font-semibold transition-colors duration-300',
					isActive ? 'border-action text-action' : 'border-border text-text-muted'
				)}
			>
				{String(index + 1).padStart(2, '0')}
			</span>
			<div>
				<h3
					className={cn(
						'font-semibold transition-colors duration-300',
						isActive ? 'text-text' : 'text-text-muted'
					)}
				>
					{t(step.title)}
				</h3>
				<p className="text-text-muted mt-1 text-sm leading-relaxed">{t(step.body)}</p>
			</div>
		</div>
	)
}

// One of the stage's three pictures. Pinned, they cross-fade as the steps
// change; in the list, each sits under its step.
function StageLayer({
	step,
	demo,
	pair,
	isShown,
	isAnimated = false
}: {
	step: number
	demo: LandingDemo
	pair: LandingPair
	isShown: boolean
	isAnimated?: boolean
}) {
	const content =
		step === 0 ? (
			<FilesPicture demo={demo} />
		) : step === 1 ? (
			<SuggestedPicture demo={demo} pair={pair} />
		) : (
			<VerdictPicture demo={demo} pair={pair} />
		)
	if (!isAnimated)
		return <div className="absolute inset-0 grid place-items-center p-5">{content}</div>
	return (
		<m.div
			className="absolute inset-0 grid place-items-center p-8"
			initial={false}
			animate={
				isShown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: STAGE_SHIFT_PX, scale: 0.98 }
			}
			transition={{ duration: STAGE_S, ease: EASE }}
		>
			{content}
		</m.div>
	)
}

const card = 'border-border bg-surface rounded-md border shadow-[0_8px_24px_rgb(15_23_32/0.08)]'

function FilesPicture({ demo }: { demo: LandingDemo }) {
	const t = useTranslations('HomePage')
	const files = [
		{ name: demo.recordsFile, meta: t('visualRows', { count: demo.recordCount }), isRecords: true },
		...demo.vendors.map((vendor) => ({
			name: vendor.fileName,
			meta: t(vendor.format === 'pair' ? 'visualVendorPairs' : 'visualVendorGroups', {
				vendor: vendor.name
			}),
			isRecords: false
		}))
	]
	return (
		<ul className="w-full max-w-md space-y-3">
			{files.map((file) => (
				<li key={file.name} className={cn(card, 'flex items-center gap-3 px-4 py-3')}>
					<CsvFileIcon
						size={ICON_SIZE}
						className={file.isRecords ? 'text-action' : 'text-text-muted'}
					/>
					<span className="min-w-0">
						<span className="block truncate font-mono text-xs">{file.name}</span>
						<span className="text-text-muted block text-xs">{file.meta}</span>
					</span>
				</li>
			))}
		</ul>
	)
}

function RecordCard({ pair, side }: { pair: LandingPair; side: 0 | 1 }) {
	const t = useTranslations('HomePage')
	const email = pair.fields.find((field) => field.role === 'email')
	const born = pair.fields.find((field) => field.role === 'date_of_birth')
	const valueOf = (field: typeof email) => (field == null ? '' : side === 0 ? field.a : field.b)
	return (
		<div className={cn(card, 'min-w-0 px-4 py-3')}>
			<span className="text-text-muted block font-mono text-[11px]">{pair.refs[side]}</span>
			<span className="block text-sm font-semibold">{pair.names[side]}</span>
			<span className="text-text-muted block truncate font-mono text-[11px]">{valueOf(email)}</span>
			<span className="text-text-muted block font-mono text-[11px]">
				{valueOf(born) || t('panelEmpty')}
			</span>
		</div>
	)
}

// PairSight picks the pair: the two records, and what they share.
function SuggestedPicture({ demo, pair }: { demo: LandingDemo; pair: LandingPair }) {
	const t = useTranslations('HomePage')
	const tRules = useTranslations('Rules')
	return (
		<div className="w-full max-w-lg space-y-4">
			<div className="grid grid-cols-2 gap-3">
				<RecordCard pair={pair} side={0} />
				<RecordCard pair={pair} side={1} />
			</div>
			<ul className="flex flex-wrap gap-1.5">
				<li className="bg-accent text-accent-ink flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap">
					<CheckIcon size={CHIP_ICON_SIZE} />
					{t('visualSuggested')}
				</li>
				{pair.reasons.map((reason) => (
					<li
						key={reason}
						className="border-border bg-surface rounded-full border px-2.5 py-1 text-xs whitespace-nowrap"
					>
						{tRules(`reason_${reason}`)}
					</li>
				))}
				<li className="border-border bg-surface flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap">
					{t('visualThreshold')}{' '}
					<span className="font-mono font-medium">{demo.threshold.toFixed(2)}</span>
				</li>
			</ul>
		</div>
	)
}

function VerdictPicture({ demo, pair }: { demo: LandingDemo; pair: LandingPair }) {
	const t = useTranslations('HomePage')
	return (
		<div className="w-full max-w-md space-y-3">
			<div className={cn(card, 'space-y-2 px-4 py-3')}>
				<p className="flex items-center justify-between text-xs">
					<span className="text-text-muted">{t('visualJev')}</span>
					<span className="font-mono">
						{pair.refs[0]} · {pair.refs[1]}
					</span>
				</p>
				<ScoreBar score={pair.score} threshold={demo.threshold} size="lg" />
				<p className="text-sm font-semibold">{t('visualMatch')}</p>
			</div>
			<ul className={cn(card, 'space-y-1.5 px-4 py-3 text-sm')}>
				{demo.vendors.map((vendor, index) => {
					const isMatched = pair.matchedBy.includes(index)
					return (
						<li key={vendor.name} className="flex items-center justify-between gap-3">
							<span>{vendor.name}</span>
							<span
								className={cn(
									'flex items-center gap-1 text-xs',
									isMatched ? 'text-text' : 'text-text-muted'
								)}
							>
								{isMatched ? (
									<CheckIcon size={CHIP_ICON_SIZE} />
								) : (
									<MinusIcon size={CHIP_ICON_SIZE} />
								)}
								{t(isMatched ? 'visualVendorMatched' : 'visualVendorMissed')}
							</span>
						</li>
					)
				})}
			</ul>
			<CategoryBadge
				category={categorize({
					status: 'succeeded',
					score: pair.score,
					isVendorMatch: pair.matchedBy.length > 0,
					threshold: demo.threshold
				})}
			/>
		</div>
	)
}

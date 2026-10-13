'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Slider as SliderPrimitive } from 'radix-ui'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, ChevronDownIcon, SlidersIcon } from '@/components/ui/icons'
import { SCORE_BANDS } from '@/lib/pairsight/decisions'
import { cn } from '@/lib/cn'
import { useCutoffPreview } from './cutoff-preview'
import { CUTOFF_OPEN_PARAM as OPEN_PARAM } from './query'

const STEP = 0.01
const PERCENT = 100
const ARROW_SIZE = 13
const TAB_ICON_SIZE = 14
// Remembers, per viewer, that the drawer has been opened once, so the tab
// only invites ("Try another cut-off", one pulse) until then.
const SEEN_KEY = 'pairsight:cutoff-drawer-seen'

function noSubscription() {
	return () => {}
}
function readSeen(): boolean {
	try {
		return window.localStorage.getItem(SEEN_KEY) === '1'
	} catch {
		return true
	}
}
function markSeen() {
	try {
		window.localStorage.setItem(SEEN_KEY, '1')
	} catch {
		// Storage can be unavailable (private mode): the invite just shows again.
	}
}
const TICKS = [0, 0.25, 0.5, 0.75, 1]
const at = (value: number) => `${value * PERCENT}%`

function clampToStep(value: number): number {
	return Math.min(1, Math.max(0, Math.round(value * PERCENT) / PERCENT))
}

// The match cut-off on the Overview, as a drawer that hangs from the top of
// the page: a tab showing the cut-off (coral while another is previewed)
// stays stuck under the top bar as the page scrolls, and opens a panel with a
// slider you can drag (or move with the arrow keys) to watch the verdict and
// the vendor cards change live. The panel slides over the page rather than
// pushing it, so nothing moves; the tab or Escape closes it. It's a
// read-only "what if": nothing here is saved or sent anywhere, and it's gone
// on reload. The run keeps its own cut-off, which every list and pair still
// uses, and Reset puts it back. A new cut-off for real is set in What Jev
// checks and only applies to a new run (cutoff-preview.tsx).
export function CutoffBar({ rulesHref }: { rulesHref: string }) {
	const t = useTranslations('Results')
	const tScale = useTranslations('CutoffScale')
	const { runThreshold, threshold, setThreshold, reset, isPreviewing } = useCutoffPreview(0)
	// Detailed analysis links here with ?cutoff=open: the drawer starts open.
	const startsOpen = useSearchParams().get(OPEN_PARAM) === 'open'
	const [isOpen, setIsOpen] = useState(startsOpen)
	const [hasOpened, setHasOpened] = useState(startsOpen)
	// Seen before (or on the server, where there's no storage): no invite.
	const wasSeen = useSyncExternalStore(noSubscription, readSeen, () => true)
	const isInviting = !wasSeen && !hasOpened && !isPreviewing
	const tabRef = useRef<HTMLButtonElement>(null)
	const thumbRef = useRef<HTMLSpanElement>(null)

	// Opening moves focus to the slider; closing gives it back to the tab, so
	// keyboard users never lose their place.
	function open() {
		setIsOpen(true)
		setHasOpened(true)
		markSeen()
		requestAnimationFrame(() => thumbRef.current?.focus())
	}
	function close() {
		setIsOpen(false)
		tabRef.current?.focus()
	}

	// Opened by that link: the slider takes focus, and the param leaves the
	// address, so a reload or a shared link doesn't open it again.
	useEffect(() => {
		if (!startsOpen) return
		markSeen()
		// After the navigation's own focus handling, as open() does.
		const frame = requestAnimationFrame(() => thumbRef.current?.focus())
		const url = new URL(window.location.href)
		url.searchParams.delete(OPEN_PARAM)
		window.history.replaceState(null, '', url)
		return () => cancelAnimationFrame(frame)
	}, [startsOpen])

	useEffect(() => {
		if (!isOpen) return
		function onKey(event: KeyboardEvent) {
			if (event.key !== 'Escape') return
			setIsOpen(false)
			tabRef.current?.focus()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [isOpen])

	// Sticky with no height of its own, so it takes no room on the page: the
	// panel and its tab hang from it. It spans <main> edge to edge (the page
	// sits in an inline-size container, so 50cqw is half of main), with its
	// contents in line with the page column.
	return (
		// On a phone the tab would hang over the headline, so the page leaves
		// room for it under the line.
		<div className="sticky top-0 z-30 mx-[calc(50%-50cqw)] h-0 max-[599px]:mb-12">
			<div
				className={cn(
					'relative grid transition-[grid-template-rows] duration-300 ease-out',
					isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				)}
			>
				{/* The panel's shadow, outside the wrapper that clips it for the slide:
				    the page beneath reads as under the panel, not cut off by it. */}
				<div
					aria-hidden
					className={cn(
						'pointer-events-none absolute inset-x-0 top-full h-8 bg-linear-to-b from-black/10 to-transparent transition-opacity duration-300 dark:from-black/70',
						isOpen ? 'opacity-100' : 'opacity-0'
					)}
				/>
				<div className="min-h-0 overflow-hidden" inert={!isOpen}>
					<section
						id="cutoff-panel"
						aria-label={t('thresholdLabel')}
						className={cn(
							'shadow-elevated border-b transition-[border-color,background-color] duration-200',
							isPreviewing ? 'border-action bg-bg bg-brand-wash' : 'border-border bg-bg'
						)}
					>
						<div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8">
							{/* One row: the value on the left, what it is and the actions on the
							    right. Reset always holds its place (hidden and disabled until
							    there's something to reset), so nothing moves while dragging. */}
							<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
								<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
									<span className="text-text-muted type-ui">{t('thresholdLabel')}</span>
									<span
										className={cn(
											'font-mono text-3xl leading-none font-medium tracking-[-0.03em]',
											isPreviewing ? 'text-accent-ink' : 'text-text'
										)}
									>
										{threshold.toFixed(2)}
									</span>
									<span className="type-ui text-text-muted" aria-live="polite">
										{isPreviewing
											? t('cutoffPreviewing', { value: runThreshold.toFixed(2) })
											: null}
									</span>
								</div>
								<div className="flex items-center gap-4">
									<Button
										variant="secondary"
										size="sm"
										onClick={reset}
										disabled={!isPreviewing}
										aria-hidden={!isPreviewing}
										className={cn(!isPreviewing && 'invisible')}
									>
										{t('resetTo', { value: runThreshold.toFixed(2) })}
									</Button>
									<Link
										href={rulesHref}
										className="text-accent-ink type-ui hit-area inline-flex items-center gap-1 font-medium whitespace-nowrap hover:underline"
									>
										{t('thresholdChangeInRules')}
										<ArrowRightIcon size={ARROW_SIZE} />
									</Link>
								</div>
							</div>

							{/* The slider: Jev's 0–1 scale with where scores fall in our tests
							    shaded, and the cut-off as a coral pin you can drag. */}
							<div className="mt-1 pt-8">
								<SliderPrimitive.Root
									min={0}
									max={1}
									step={STEP}
									value={[threshold]}
									onValueChange={([value]) => {
										if (value != null) setThreshold(clampToStep(value))
									}}
									className="relative flex h-5 w-full touch-none items-center select-none"
								>
									<SliderPrimitive.Track className="bg-border relative h-2.5 w-full grow overflow-hidden rounded-full">
										<span
											className="bg-text-muted/40 absolute inset-y-0 left-0"
											style={{ width: at(SCORE_BANDS.differentUpTo) }}
										/>
										<span
											className="bg-action/45 absolute inset-y-0 right-0"
											style={{ left: at(SCORE_BANDS.sameFrom) }}
										/>
									</SliderPrimitive.Track>
									{/* Where the run's own cut-off sits, while another is previewed. */}
									{isPreviewing && (
										<span
											aria-hidden
											className="bg-text-muted absolute -top-0.5 -bottom-0.5 w-[2px] -translate-x-1/2 rounded-full"
											style={{ left: at(runThreshold) }}
										/>
									)}
									<SliderPrimitive.Thumb
										ref={thumbRef}
										aria-label={t('thresholdLabel')}
										aria-valuetext={threshold.toFixed(2)}
										className="group hit-area relative block h-6 w-1.5 cursor-grab rounded-full outline-none active:cursor-grabbing"
									>
										<span className="bg-action ring-surface absolute inset-0 rounded-full ring-2 transition-transform duration-150 group-hover:scale-x-150 group-focus-visible:scale-x-150" />
										<span className="bg-action text-action-ink group-focus-visible:outline-focus absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded-full px-2 py-0.5 font-mono text-[0.6875rem] leading-4 font-medium group-focus-visible:outline-2 group-focus-visible:outline-offset-2">
											{threshold.toFixed(2)}
										</span>
									</SliderPrimitive.Thumb>
								</SliderPrimitive.Root>
								<div
									aria-hidden
									className="text-text-muted relative mt-1.5 h-4 font-mono text-[0.6875rem]"
								>
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
							</div>

							<p className="text-text-muted mt-3 text-xs">
								{isPreviewing
									? t('cutoffPreviewNote', { value: runThreshold.toFixed(2) })
									: t('cutoffDragHint')}{' '}
								<span className={isPreviewing ? 'hidden' : 'hidden @3xl:inline'}>
									{tScale('different', { value: SCORE_BANDS.differentUpTo.toFixed(2) })} ·{' '}
									{tScale('same', { value: SCORE_BANDS.sameFrom.toFixed(2) })}
								</span>
							</p>
						</div>
					</section>
				</div>
			</div>
			{/* The tab: hangs from the panel's edge (or from the top bar while
			    closed), at the right of the page column. */}
			<div className="mx-auto flex max-w-[1280px] justify-end px-4 md:px-8">
				<button
					ref={tabRef}
					type="button"
					aria-expanded={isOpen}
					aria-controls="cutoff-panel"
					aria-label={t('cutoffTabLabel', { value: threshold.toFixed(2) })}
					onClick={() => (isOpen ? close() : open())}
					className={cn(
						'type-ui shadow-elevated -mt-px flex h-8 items-center gap-2 rounded-b-lg border border-t-0 px-3 font-medium transition-colors duration-150 pointer-coarse:h-11',
						isPreviewing
							? 'border-action bg-action text-action-ink hover:bg-action-active'
							: 'border-border bg-bg text-text hover:bg-surface-hover',
						isInviting && 'border-action text-accent-ink'
					)}
				>
					<SlidersIcon size={TAB_ICON_SIZE} />
					<span>
						{isInviting ? (
							t('cutoffTabInvite')
						) : (
							<>
								{isPreviewing ? t('cutoffTabPreview') : t('cutoffTab')}{' '}
								<span className="font-mono">{threshold.toFixed(2)}</span>
							</>
						)}
					</span>
					<ChevronDownIcon
						size={TAB_ICON_SIZE}
						className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
					/>
				</button>
			</div>
		</div>
	)
}

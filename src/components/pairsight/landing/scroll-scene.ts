// Scroll-linked animation for the landing page, the same in every browser.
//
// The design (pairsight-handoff Landing.dc.html) drives its keyframes with
// CSS scroll timelines, which only Chromium runs. Here the keyframes stay in
// CSS (landing.css, every name starting `ls-`), declared paused, and this
// module sets each one's progress from the scroll position, using the
// spec's own named ranges (CSS Scroll-Driven Animations: cover, contain,
// entry, exit). An element says what drives it:
//
//   data-range="contain 34% contain 66%"   its start and end
//   data-timeline="story"                  measured against the walkthrough
//                                          (otherwise against itself)
//   data-count-from / data-count-to        a number that runs between two
//                                          values over the range instead
//   data-scroll-subtree                    drives its descendants' keyframes
//                                          too (an SVG's paths, which have no
//                                          layout box of their own)
//
// Positions are measured from layout (offsetTop), never from transformed
// boxes, so an element's own animation can't move its range. Progress
// glides toward its target (GLIDE_MS), one rAF at a time
// until everything settles; nothing goes through React.

type RangeName = 'cover' | 'contain' | 'entry' | 'exit'
type RangePoint = { name: RangeName; percent: number }

type Item = {
	element: HTMLElement
	subject: HTMLElement
	start: RangePoint
	end: RangePoint
	animations: Animation[]
	count: { from: number; to: number; format: Intl.NumberFormat } | null
}

// Every scroll keyframe runs for this long; progress maps onto it.
export const SCROLL_DURATION_MS = 1000
// The shown progress closes the gap to where the scroll puts it with this
// time constant, so a wheel's 100px jumps (or a dragged scrollbar) glide
// instead of snapping from one pose to the next. By time, not by frame, so
// it feels the same at any frame rate. Close enough, it settles.
const GLIDE_MS = 80
const SETTLED = 0.0005
// A first frame after rest counts as one at 60 frames a second.
const FRAME_MS = 1000 / 60
const PREFIX = 'ls-'
const RANGE_NAMES: RangeName[] = ['cover', 'contain', 'entry', 'exit']
const PERCENT = 100
// The counter's easing, as the design gives it: cubic-bezier(.3, .5, .5, 1).
const COUNT_EASING: [number, number, number, number] = [0.3, 0.5, 0.5, 1]
const BEZIER_STEPS = 8
// The walkthrough only pins on a wide screen (landing.css); narrower, its
// scenes stack in their finished state and nothing on its timeline runs.
const PINNED = '(min-width: 900px)'

function parsePoint(name: string | undefined, value: string | undefined): RangePoint | null {
	const range = RANGE_NAMES.find((candidate) => candidate === name)
	const percent = Number.parseFloat(value ?? '')
	return range == null || Number.isNaN(percent) ? null : { name: range, percent }
}

// "contain 34% contain 66%" → its two ends.
export function parseRange(text: string): { start: RangePoint; end: RangePoint } | null {
	const [startName, startValue, endName, endValue] = text.trim().split(/\s+/)
	const start = parsePoint(startName, startValue)
	const end = parsePoint(endName, endValue)
	return start == null || end == null ? null : { start, end }
}

// Where the subject's top sits, relative to the viewport, at one point of a
// named range: the spec's definitions for a block-axis view timeline.
export function rangeTop(point: RangePoint, viewport: number, height: number): number {
	const fit = Math.min(height, viewport)
	const [from, to] =
		point.name === 'cover'
			? [viewport, -height]
			: point.name === 'contain'
				? height <= viewport
					? [viewport - height, 0]
					: [0, viewport - height]
				: point.name === 'entry'
					? [viewport, viewport - fit]
					: [fit - height, -height]
	return from + (to - from) * (point.percent / PERCENT)
}

// How far through its range an element is, 0 to 1.
export function progressAt(
	top: number,
	range: { start: RangePoint; end: RangePoint },
	viewport: number,
	height: number
): number {
	const from = rangeTop(range.start, viewport, height)
	const to = rangeTop(range.end, viewport, height)
	if (from === to) return top <= to ? 1 : 0
	return Math.min(1, Math.max(0, (top - from) / (to - from)))
}

// A cubic Bézier easing, solved for x by bisection.
export function bezier([x1, y1, x2, y2]: [number, number, number, number], x: number): number {
	const at = (t: number, a: number, b: number) =>
		3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
	let low = 0
	let high = 1
	for (let step = 0; step < BEZIER_STEPS * 4; step++) {
		const mid = (low + high) / 2
		if (at(mid, x1, x2) < x) low = mid
		else high = mid
	}
	return at((low + high) / 2, y1, y2)
}

function pageTop(element: HTMLElement): number {
	let top = 0
	for (let node: HTMLElement | null = element; node != null;) {
		top += node.offsetTop
		node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
	}
	return top
}

function formatter(): Intl.NumberFormat {
	return new Intl.NumberFormat(document.documentElement.lang || 'en')
}

// A counter at rest shows where it ends.
function settleCount(element: HTMLElement) {
	const to = Number(element.dataset.countTo)
	if (!Number.isNaN(to)) element.textContent = formatter().format(to)
}

function itemsIn(root: HTMLElement): Item[] {
	const story = root.querySelector<HTMLElement>('[data-timeline-subject="story"]')
	const isPinned = window.matchMedia(PINNED).matches
	return [...root.querySelectorAll<HTMLElement>('[data-range]')].flatMap((element) => {
		const range = parseRange(element.dataset.range ?? '')
		const isStory = element.dataset.timeline === 'story'
		const subject = isStory ? story : element
		if (range == null || subject == null) return []
		if (isStory && !isPinned) {
			settleCount(element)
			return []
		}
		const from = Number(element.dataset.countFrom)
		const to = Number(element.dataset.countTo)
		return [
			{
				element,
				subject,
				...range,
				animations: element
					.getAnimations({ subtree: element.dataset.scrollSubtree != null })
					.filter(
						(animation) =>
							animation instanceof CSSAnimation && animation.animationName.startsWith(PREFIX)
					),
				count: Number.isNaN(from) || Number.isNaN(to) ? null : { from, to, format: formatter() }
			}
		]
	})
}

// Starts driving every `data-range` element under `root`; returns the stop.
export function startScrollScene(root: HTMLElement): () => void {
	let items: Item[] = []
	let tops = new Map<HTMLElement, { top: number; height: number }>()
	let frame = 0

	function measure() {
		items = itemsIn(root)
		tops = new Map(
			[...new Set(items.map((item) => item.subject))].map((subject) => [
				subject,
				{ top: pageTop(subject), height: subject.offsetHeight }
			])
		)
	}

	// Where each element is shown, which trails where the scroll puts it.
	const shown = new Map<HTMLElement, number>()

	let lastFrame = 0

	function update(isSnap = false) {
		frame = 0
		const now = performance.now()
		// How far this frame closes the gap: about a fifth at 60 frames a second.
		const elapsed = lastFrame === 0 ? FRAME_MS : now - lastFrame
		const glide = 1 - Math.exp(-elapsed / GLIDE_MS)
		lastFrame = now
		const viewport = document.documentElement.clientHeight
		const scrolled = window.scrollY
		let isMoving = false
		for (const item of items) {
			const box = tops.get(item.subject)
			if (box == null) continue
			const target = progressAt(box.top - scrolled, item, viewport, box.height)
			const from = shown.get(item.element) ?? target
			const glided = isSnap ? target : from + (target - from) * glide
			const progress = Math.abs(target - glided) < SETTLED ? target : glided
			if (progress !== target) isMoving = true
			if (progress === from && !isSnap) continue
			shown.set(item.element, progress)
			for (const animation of item.animations) {
				animation.currentTime = progress * SCROLL_DURATION_MS
			}
			if (item.count != null) {
				const { from, to, format } = item.count
				const value = Math.round(from + (to - from) * bezier(COUNT_EASING, progress))
				const text = format.format(value)
				if (item.element.textContent !== text) item.element.textContent = text
			}
		}
		if (isMoving) schedule()
		// Still, the next movement starts its clock afresh.
		else lastFrame = 0
	}

	function schedule() {
		if (frame === 0) frame = requestAnimationFrame(() => update())
	}

	// The layout changed (a resize, fonts arriving): the animations are read
	// afresh, so each is put straight where it belongs.
	function remeasure() {
		measure()
		cancelAnimationFrame(frame)
		update(true)
	}

	measure()
	// Where the page opens, things start in place rather than gliding there.
	update(true)
	const resize = new ResizeObserver(remeasure)
	resize.observe(document.body)
	window.addEventListener('scroll', schedule, { passive: true })
	window.addEventListener('resize', remeasure)
	return () => {
		cancelAnimationFrame(frame)
		for (const item of items) if (item.count != null) settleCount(item.element)
		resize.disconnect()
		window.removeEventListener('scroll', schedule)
		window.removeEventListener('resize', remeasure)
	}
}

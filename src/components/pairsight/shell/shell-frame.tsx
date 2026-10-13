'use client'

import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'motion/react'
import { usePathname } from '@/i18n/routing'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EASE_OUT_SOFT } from '@/components/ui/reveal'
import { Dock, PipelineProvider } from './dock'
import type { PipelineData } from './pipeline-types'

const PAGE_DURATION_S = 0.18
// The skip links: hidden until focused, then pinned top left.
const SKIP_LINK =
	'bg-surface text-text sr-only rounded-sm px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:inline-flex focus:min-h-11 focus:items-center'
// What keyboard focus can land on inside the dock.
const FOCUSABLE = 'a[href], button:not([disabled])'

// The second skip link: to the visible dock's main action (the last control,
// "Next: …" or Download), so the page's way on isn't behind every control on
// the page; Shift+Tab from there reaches the steps. The shell's dock and a
// page's own are both in the DOM with one hidden, so it looks for the one
// showing. With no dock, the content.
function skipToActions(event: React.MouseEvent<HTMLAnchorElement>) {
	event.preventDefault()
	const dock = [...document.querySelectorAll<HTMLElement>('[data-dock]')].find((each) =>
		each.checkVisibility()
	)
	const controls = dock == null ? [] : [...dock.querySelectorAll<HTMLElement>(FOCUSABLE)]
	const target = controls.at(-1) ?? document.getElementById('main')
	target?.focus()
}

// The app shell's client half (docs/PairSight-UX-Plan.md §3): the top bar,
// then the page, which scrolls inside <main> and fades in on every
// navigation, its sections rising in one after another (motion.css,
// .page-frame). On an evaluation the dock floats over the bottom of the
// page: the page's own (with its next action) or, failing that, the
// shell's, with the steps alone.
export function ShellFrame({
	topBar,
	pipeline,
	children
}: {
	topBar: React.ReactNode
	pipeline?: PipelineData
	children: React.ReactNode
}) {
	const t = useTranslations('Shell')
	const pathname = usePathname()
	const isReduced = useReducedMotion() === true

	return (
		<PipelineProvider pipeline={pipeline}>
			<TooltipProvider>
				<div data-shell-root className="bg-bg text-text flex h-dvh w-full flex-col overflow-hidden">
					<a href="#main" className={SKIP_LINK}>
						{t('skipToContent')}
					</a>
					<a href="#main" onClick={skipToActions} className={SKIP_LINK}>
						{t('skipToActions')}
					</a>
					{topBar}
					<main
						id="main"
						tabIndex={-1}
						// Room under the floating dock, so a focused control scrolls
						// into view above it rather than behind it.
						className="relative flex-1 scroll-pb-28 overflow-y-auto focus:outline-none max-[599px]:scroll-pb-36"
					>
						{/* The width the page can use, for its container queries. On
						    <main> itself that width would include a classic scrollbar. */}
						<div className="[container-type:inline-size] flex min-h-full flex-col">
							<motion.div
								key={pathname}
								className="page-frame mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 pt-10 pb-5 md:px-8 md:pt-14"
								// The same first frame on the server and the client (which
								// alone knows about reduced motion); reduced, it's instant.
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: isReduced ? 0 : PAGE_DURATION_S, ease: EASE_OUT_SOFT }}
							>
								{children}
								<Dock isShell />
							</motion.div>
						</div>
					</main>
				</div>
			</TooltipProvider>
		</PipelineProvider>
	)
}

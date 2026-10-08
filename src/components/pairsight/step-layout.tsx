import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

const BACK_ICON_SIZE = 15
// The hint's id, so a blocked primary action can point at why
// (aria-describedby). One action bar per page, so one id.
export const ACTION_HINT_ID = 'action-bar-hint'

// Every step: a title, one sentence of context, the content, then the action
// bar with the stage's one primary action (docs/PairSight-UX-Plan.md §3–4).
// StepHeader and ActionBar carry the design's PageHeader and SetupActionBar
// look; each screen adopts the Back button and blocked reason as it's ported.

export function StepHeader({
	title,
	description,
	children
}: {
	// A string, or a sentence with its key number wrapped in <StepEmphasis>.
	title: React.ReactNode
	description: React.ReactNode
	// Sits beside the title: a status chip, a count.
	children?: React.ReactNode
}) {
	return (
		<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
			<div className="max-w-3xl">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<h1 className="text-text type-display-sm text-balance">{title}</h1>
					{children}
				</div>
				<p className="text-text-muted mt-2 max-w-2xl text-[0.9375rem] leading-relaxed">
					{description}
				</p>
			</div>
		</header>
	)
}

// The number a step's headline turns on, in coral ("Jev will check 812 pairs").
export function StepEmphasis({ children }: { children: React.ReactNode }) {
	return <em className="text-accent-ink not-italic">{children}</em>
}

export function ActionBar({
	hint,
	back,
	children,
	className
}: {
	hint?: React.ReactNode
	// The previous stage, on the left.
	back?: { href: string; label: string }
	children: React.ReactNode
	className?: string
}) {
	// Docked to the bottom of the page: `mt-auto` rests it at the bottom of a
	// short page (the transparent `pt-8` keeps a gap above it) and sticky
	// keeps it in view on a long one. It spans <main> edge to edge — the page
	// sits in an inline-size container (shell-frame.tsx) as wide as main's
	// visible area, so 50cqw is half of it — while its contents line up with
	// the page column.
	return (
		<div className="pointer-events-none sticky bottom-0 z-20 mx-[calc(50%-50cqw)] mt-auto -mb-10 pt-8">
			<div data-action-bar className="border-border bg-bg pointer-events-auto border-t">
				<div
					className={cn(
						'mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3 md:px-8',
						className
					)}
				>
					{back != null && (
						<Button variant="secondary" asChild>
							<Link href={back.href}>
								<ArrowLeftIcon size={BACK_ICON_SIZE} />
								{back.label}
							</Link>
						</Button>
					)}
					{/* Narrow, the hint gets its own line on top, so Back and the main
					    action share one row below it instead of stacking three high. */}
					{hint != null && (
						<p
							id={ACTION_HINT_ID}
							role="status"
							className="text-text-muted type-ui order-first flex min-w-0 basis-full items-center gap-1.5 @3xl:order-none @3xl:ml-auto @3xl:basis-auto"
						>
							{hint}
						</p>
					)}
					<div
						className={cn(
							'ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3',
							hint != null && '@3xl:ml-0'
						)}
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	)
}

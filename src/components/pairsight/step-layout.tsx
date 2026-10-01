import { IconTile, type TileIcon } from '@/components/ui/icon-tile'
import { cn } from '@/lib/cn'

// Every step: a title, one sentence of context, the content, then the action
// bar with the stage's one primary action (docs/PairSight-UX-Plan.md §3–4).
// StepHeader and ActionBar carry the design's PageHeader and SetupActionBar
// look; each screen adopts the Back button and blocked reason as it's ported.

export function StepHeader({
	title,
	description,
	children
}: {
	title: string
	description: string
	// Sits beside the title: a status chip, a count.
	children?: React.ReactNode
}) {
	return (
		<header className="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div className="max-w-2xl">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h1 className="text-text type-title">{title}</h1>
					{children}
				</div>
				<p className="text-text-muted mt-1.5 text-sm leading-relaxed">{description}</p>
			</div>
		</header>
	)
}

export function ActionBar({
	hint,
	children,
	className
}: {
	hint?: React.ReactNode
	children: React.ReactNode
	className?: string
}) {
	// Docked to the bottom of the page: `mt-auto` rests it at the bottom of a
	// short page (the transparent `pt-8` keeps a gap above it) and sticky
	// keeps it in view on a long one. It spans <main> edge to edge — main is
	// an inline-size container, so 50cqw is half its width — while its
	// contents line up with the page column.
	return (
		<div className="pointer-events-none sticky bottom-0 z-20 mx-[calc(50%-50cqw)] mt-auto -mb-10 pt-8">
			<div className="border-border bg-surface pointer-events-auto border-t">
				<div
					className={cn(
						'mx-auto flex max-w-[1280px] flex-wrap items-center justify-end gap-3 px-4 py-3 md:px-8',
						className
					)}
				>
					{hint != null && (
						<p role="status" className="text-text-muted type-ui mr-auto flex items-center gap-1.5">
							{hint}
						</p>
					)}
					{children}
				</div>
			</div>
		</div>
	)
}

// A card section. Its icon sits in a tile beside the heading (DESIGN.md §5).
export function Section({
	title,
	description,
	icon,
	children,
	className
}: {
	title: string
	description?: string
	icon?: TileIcon
	children: React.ReactNode
	className?: string
}) {
	return (
		<section className={cn('border-border bg-surface rounded-lg border p-5', className)}>
			<div className="flex items-start gap-3">
				{icon != null && <IconTile icon={icon} />}
				<div className="flex min-w-0 flex-col">
					<h2 className="text-text type-heading">{title}</h2>
					{description != null && <p className="text-text-muted type-body mt-0.5">{description}</p>}
				</div>
			</div>
			<div className="mt-4">{children}</div>
		</section>
	)
}

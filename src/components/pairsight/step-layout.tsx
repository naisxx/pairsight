import { cn } from '@/lib/cn'

// Every step: a title, one sentence of context, the content, then the action
// bar with the stage's one primary action (docs/PairSight-UX-Plan.md §3–4).

export function StepHeader({
	title,
	description,
	children
}: {
	title: string
	description: string
	children?: React.ReactNode
}) {
	return (
		<div className="mb-6 flex flex-col gap-1">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h1 className="text-text type-title">{title}</h1>
				{children}
			</div>
			<p className="text-text-muted type-body max-w-3xl">{description}</p>
		</div>
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
	return (
		<div
			className={cn(
				'border-border bg-surface/90 sticky bottom-0 z-30 -mx-4 mt-8 flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border',
				className
			)}
		>
			{hint != null && <p className="text-text-muted type-body mr-auto">{hint}</p>}
			{children}
		</div>
	)
}

export function Section({
	title,
	description,
	children,
	className
}: {
	title: string
	description?: string
	children: React.ReactNode
	className?: string
}) {
	return (
		<section className={cn('border-border bg-surface rounded-lg border p-5', className)}>
			<h2 className="text-text type-heading">{title}</h2>
			{description != null && <p className="text-text-muted type-body mt-1">{description}</p>}
			<div className="mt-4">{children}</div>
		</section>
	)
}

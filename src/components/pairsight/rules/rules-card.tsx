import { cn } from '@/lib/cn'

// One card of the "What Jev checks" step: a coral eyebrow, a title, one line
// of context, then the card's own content filling the rest of its height,
// so the cards in a row line up top and bottom (rules-form.tsx).
export function RulesCard({
	id,
	eyebrow,
	title,
	description,
	footer,
	className,
	children
}: {
	id: string
	eyebrow: string
	title: React.ReactNode
	description?: React.ReactNode
	// A note pinned to the bottom of the card, under a hairline.
	footer?: React.ReactNode
	className?: string
	children: React.ReactNode
}) {
	return (
		<section
			aria-labelledby={`${id}-title`}
			className={cn('border-border bg-surface flex min-w-0 flex-col rounded-lg border', className)}
		>
			<header className="px-5 pt-5 md:px-6 md:pt-6">
				<p className="text-accent-ink type-eyebrow">{eyebrow}</p>
				<h2 id={`${id}-title`} className="type-heading mt-1.5 flex items-center gap-1">
					{title}
				</h2>
				{description != null && (
					<p className="type-ui text-text-muted mt-1 leading-relaxed">{description}</p>
				)}
			</header>
			<div className="flex flex-1 flex-col px-5 pt-4 pb-5 md:px-6 md:pb-6">{children}</div>
			{footer != null && (
				<p className="border-border text-text-muted flex items-center gap-2 border-t px-5 py-3 text-xs md:px-6">
					{footer}
				</p>
			)}
		</section>
	)
}

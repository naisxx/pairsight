import { cn } from '@/lib/cn'

// One card of the "What Jev checks" step (pairsight-handoff Setup): on the
// left its letter, title and one line of context; on the right the card's
// own content, with an optional note under it. The two sides stack when
// there isn't room for both.
export function RulesCard({
	id,
	letter,
	title,
	description,
	footer,
	className,
	children
}: {
	id: string
	// A, B, C or D: the cards in order.
	letter: string
	title: React.ReactNode
	description?: React.ReactNode
	// A note under the content.
	footer?: React.ReactNode
	className?: string
	children: React.ReactNode
}) {
	return (
		<section
			aria-labelledby={`${id}-title`}
			className={cn(
				'border-border bg-surface flex min-w-0 flex-wrap gap-x-12 gap-y-5 rounded-lg border p-6 md:p-7',
				className
			)}
		>
			<header className="max-w-[320px] min-w-0 flex-[1_1_260px]">
				<p className="text-text-muted type-eyebrow">{letter}</p>
				<h2
					id={`${id}-title`}
					className="text-text font-display mt-2.5 flex items-center gap-1.5 text-[1.625rem] leading-tight font-semibold tracking-[-0.025em]"
				>
					{title}
				</h2>
				{description != null && <p className="text-text-muted mt-2 text-sm">{description}</p>}
			</header>
			<div className="flex min-w-0 flex-[2_1_480px] flex-col">
				{children}
				{footer != null && (
					<p className="text-text-muted mt-4 flex items-center gap-2 text-sm">{footer}</p>
				)}
			</div>
		</section>
	)
}

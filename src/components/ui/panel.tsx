import { cn } from '@/lib/cn'

// The card every screen is built from: a hairline-bordered surface with an
// optional header (title, one line of description, actions on the right).
export function Panel({
	title,
	description,
	actions,
	as: Tag = 'section',
	id,
	className,
	bodyClassName,
	children
}: {
	title?: React.ReactNode
	description?: React.ReactNode
	actions?: React.ReactNode
	as?: 'section' | 'div'
	id?: string
	className?: string
	bodyClassName?: string
	children: React.ReactNode
}) {
	const titleId = title != null && id != null ? `${id}-title` : undefined
	return (
		<Tag
			id={id}
			aria-labelledby={titleId}
			className={cn('border-border bg-surface rounded-md border', className)}
		>
			{(title != null || actions != null) && (
				<header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-1">
					<div className="min-w-0">
						{title != null && (
							<h2 id={titleId} className="text-text type-subheading">
								{title}
							</h2>
						)}
						{description != null && (
							<p className="text-text-muted type-meta mt-0.5">{description}</p>
						)}
					</div>
					{actions != null && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
				</header>
			)}
			<div className={cn('p-4', bodyClassName)}>{children}</div>
		</Tag>
	)
}

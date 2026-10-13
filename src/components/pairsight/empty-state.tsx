import { cn } from '@/lib/cn'

// Every "nothing here yet" in the app: a drawn scene (empty/scenes.tsx), a
// title, one or two sentences on what belongs here and how it gets here, and
// the way forward. `framed` puts it on its own card; unframed it sits inside
// a card that already exists.
export function EmptyState({
	scene,
	title,
	description,
	actions,
	framed = false,
	titleAs: Title = 'h2',
	className
}: {
	scene: React.ReactNode
	title: React.ReactNode
	description?: React.ReactNode
	actions?: React.ReactNode
	framed?: boolean
	titleAs?: 'h1' | 'h2' | 'h3' | 'p'
	className?: string
}) {
	return (
		<div
			className={cn(
				'flex flex-col items-center px-6 py-12 text-center',
				framed && 'border-border bg-surface rounded-lg border',
				className
			)}
		>
			{scene}
			<Title className="text-text font-display rise stagger-3 mt-6 text-[1.625rem] leading-[1.1] font-semibold tracking-[-0.025em]">
				{title}
			</Title>
			{description != null && (
				<p className="text-text-body rise stagger-4 mt-2 max-w-md text-base">{description}</p>
			)}
			{actions != null && (
				<div className="rise stagger-5 mt-6 flex flex-wrap justify-center gap-3">{actions}</div>
			)}
		</div>
	)
}

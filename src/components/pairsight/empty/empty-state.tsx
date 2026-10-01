import { cn } from '@/lib/cn'
import { GhostPreview, type GhostKind } from './ghost-preview'
import { IconTile, type TileIcon } from '@/components/ui/icon-tile'

// The product's one empty-state pattern (DESIGN.md §5): an icon tile, a
// heading, one line of explanation and the next action, left-aligned. On a
// screen shaped like a list or table, a ghost of that content sits behind it
// so it's clear what will appear; errors and simple prompts stay plain.
export function EmptyState({
	icon,
	title,
	description,
	actions,
	tone = 'neutral',
	preview,
	previewHeaders,
	className
}: {
	icon: TileIcon
	title: string
	description?: string
	actions?: React.ReactNode
	tone?: 'neutral' | 'danger'
	preview?: GhostKind
	// Column names for a table ghost, so it reads as this table.
	previewHeaders?: string[]
	className?: string
}) {
	const block = (
		<div className="flex flex-col items-start gap-2 text-left">
			<IconTile icon={icon} size="lg" tone={tone} className="mb-1" />
			<h2 className="text-text type-heading">{title}</h2>
			{description != null && (
				<p className="text-text-muted type-body max-w-[46ch]">{description}</p>
			)}
			{actions != null && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
		</div>
	)

	if (preview == null) {
		return (
			<div role={tone === 'danger' ? 'alert' : 'status'} className={cn('p-8', className)}>
				{block}
			</div>
		)
	}
	return (
		<div role="status" className={cn('relative flex min-h-[22rem] overflow-hidden p-6', className)}>
			<GhostPreview kind={preview} headers={previewHeaders} />
			<div className="border-border bg-surface/90 relative m-auto w-full max-w-md rounded-xl border p-6 backdrop-blur-[3px]">
				{block}
			</div>
		</div>
	)
}

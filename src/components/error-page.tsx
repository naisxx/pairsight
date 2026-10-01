import type { ReactNode } from 'react'
import { IconTile, type TileIcon } from '@/components/ui/icon-tile'

// Shared shell for every "something went wrong" screen (error.tsx,
// not-found.tsx) so the copy/actions differ but the layout, spacing, and
// tone don't drift between them. global-error.tsx can't use this — it may
// render before globals.css loads, so it duplicates a minimal inline-styled
// version instead (see the comment there). Never render error.message or
// a raw error object here — only copy written for the person reading it
// (see docs/rules/error-handling.md).
export function ErrorPage({
	title,
	description,
	digest,
	action,
	icon,
	tone = 'neutral'
}: {
	title: string
	description: string
	digest?: string
	action?: ReactNode
	// The same tile as the product's empty states; `danger` for real errors.
	icon: TileIcon
	tone?: 'neutral' | 'danger'
}) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-6">
			<div className="border-border bg-surface flex w-full max-w-md flex-col items-start gap-2 rounded-xl border p-8 text-left">
				<IconTile icon={icon} size="lg" tone={tone} className="mb-1" />
				<h1 className="text-text type-heading">{title}</h1>
				<p className="text-text-muted type-body">{description}</p>
				<div className="mt-2">{action}</div>
				{digest && (
					<p className="text-text-muted type-data-sm">
						Reference: <code>{digest}</code>
					</p>
				)}
			</div>
		</div>
	)
}

// The one button style every error/not-found screen uses — kept here
// instead of a full cva variant set since there's only ever one visual
// state on these pages (see docs/rules/code-style.md, cva is for 2+
// variants).
export const errorPageActionClassName =
	'rounded-md bg-action px-4 py-2 type-label text-action-ink transition-colors hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'

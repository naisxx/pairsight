import type { ReactNode } from 'react'
import { Wordmark } from '@/components/pairsight/wordmark'

// Shared shell for every "something went wrong" screen (error.tsx,
// not-found.tsx, the error boundary) so the copy/actions differ but the
// layout, spacing, and tone don't drift between them. global-error.tsx can't
// use this — it may render before globals.css loads, so it duplicates a
// minimal inline-styled version instead (see the comment there). Never render
// error.message or a raw error object here — only copy written for the person
// reading it (see docs/rules/error-handling.md).
export function ErrorPage({
	title,
	description,
	digest,
	action,
	scene
}: {
	title: string
	description: string
	digest?: string
	// One or more links/buttons, styled with errorPageActionClassName.
	action?: ReactNode
	// The drawn picture above the title (pairsight/empty/scenes.tsx).
	scene?: ReactNode
}) {
	return (
		<main
			id="main"
			className="bg-bg text-text flex min-h-dvh flex-col items-center justify-center px-6 text-center"
		>
			<Wordmark />
			{scene != null && <div className="mt-10">{scene}</div>}
			<h1 className="type-display-sm mt-8">{title}</h1>
			<p className="text-text-muted mt-3 max-w-sm text-[0.9375rem]">{description}</p>
			{action != null && <div className="mt-6 flex gap-4 text-sm font-medium">{action}</div>}
			{digest && (
				<p className="text-text-muted mt-6 font-mono text-xs">
					Reference: <code>{digest}</code>
				</p>
			)}
		</main>
	)
}

// The one action style every error/not-found screen uses: a quiet text link
// (or a button styled as one, for "Try again").
export const errorPageActionClassName = 'text-accent-ink rounded-sm font-medium hover:underline'

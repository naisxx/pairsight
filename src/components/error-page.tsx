import type { ReactNode } from 'react'
import { SlimBar } from '@/components/pairsight/slim-bar'

// Shared shell for every "something went wrong" screen (error.tsx,
// not-found.tsx, the error boundary) so the copy/actions differ but the
// layout, spacing, and tone don't drift between them. It follows the sign-in
// page: the slim bar, then the headline and the way on beside a card holding
// the drawn scene. global-error.tsx can't use this — it may render before
// globals.css loads, so it duplicates a minimal inline-styled version instead
// (see the comment there). Never render error.message or a raw error object
// here — only copy written for the person reading it (see
// docs/rules/error-handling.md).
export function ErrorPage({
	eyebrow,
	title,
	description,
	digest,
	actions,
	scene,
	homeHref = '/',
	homeLabel
}: {
	// The small caps line over the title ("Error 404").
	eyebrow?: string
	title: string
	description: string
	digest?: string
	// Buttons: the way on first (primary), any other as secondary.
	actions?: ReactNode
	// The drawn picture beside the title (pairsight/empty/scenes.tsx).
	scene?: ReactNode
	homeHref?: '/' | '/evaluations'
	homeLabel: string
}) {
	return (
		<div className="bg-bg text-text flex min-h-dvh flex-col text-base">
			<SlimBar homeHref={homeHref} homeLabel={homeLabel} />
			<div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-wrap content-center items-center gap-x-20 gap-y-12 px-4 py-16 md:px-8">
				<main id="main" className="min-w-0 flex-[1_1_360px] md:max-w-[520px]">
					{eyebrow != null && <p className="rise text-text-muted type-eyebrow mb-3">{eyebrow}</p>}
					<h1 className="rise font-display text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.025em]">
						{title}
					</h1>
					<p className="rise stagger-1 text-text-body mt-3">{description}</p>
					{actions != null && (
						<div className="rise stagger-2 mt-8 flex flex-wrap gap-3">{actions}</div>
					)}
					{digest && (
						<p className="text-text-muted mt-6 font-mono text-sm">
							Reference: <code>{digest}</code>
						</p>
					)}
				</main>
				{scene != null && (
					<div
						aria-hidden
						className="rise stagger-3 bg-surface-muted border-border flex min-h-72 min-w-0 flex-[1_1_420px] items-center justify-center rounded-lg border p-10"
					>
						{/* The scenes are drawn small, for inside a card; here they have the room. */}
						<div className="scale-150">{scene}</div>
					</div>
				)}
			</div>
		</div>
	)
}

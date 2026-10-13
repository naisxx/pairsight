import { cn } from '@/lib/cn'

export type ChipTone =
	'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'brand' | 'outline'

const TONES: Record<ChipTone, string> = {
	neutral: 'border border-border bg-surface text-text-muted',
	success: 'bg-success-subtle text-success',
	warning: 'bg-warning-subtle text-warning',
	danger: 'bg-danger-subtle text-danger',
	info: 'bg-info-subtle text-info',
	accent: 'bg-accent text-accent-ink',
	// A coral fill: the one chip that should catch the eye ("Best overall").
	brand: 'bg-action text-action-ink',
	outline: 'border border-border text-text-muted'
}

// A small status or label: a tag with 8px corners in the mono face, tinted
// by tone, with an optional leading icon. Status tones are tints with the
// token as text, so they hold contrast in both themes by construction.
export function Chip({
	tone = 'neutral',
	icon,
	title,
	className,
	children
}: {
	tone?: ChipTone
	icon?: React.ReactNode
	// The raw detail behind a friendly label (an error code, say).
	title?: string
	className?: string
	children: React.ReactNode
}) {
	return (
		<span
			title={title}
			className={cn(
				'inline-flex min-h-7 items-center gap-2 rounded-sm px-2.5 font-mono text-xs whitespace-nowrap',
				TONES[tone],
				className
			)}
		>
			{icon}
			{children}
		</span>
	)
}

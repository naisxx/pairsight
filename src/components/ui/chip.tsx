import { cn } from '@/lib/cn'

export type ChipTone =
	'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'brand' | 'outline'

const TONES: Record<ChipTone, string> = {
	neutral: 'bg-surface-muted text-text-muted',
	success: 'bg-success-subtle text-success',
	warning: 'bg-warning-subtle text-warning',
	danger: 'bg-danger-subtle text-danger',
	info: 'bg-info-subtle text-info',
	accent: 'bg-accent text-accent-ink',
	// A coral fill: the one chip that should catch the eye ("Best overall").
	brand: 'bg-action text-action-ink',
	outline: 'border border-border text-text-muted'
}

// A small status or label: a pill, tinted by tone, with an optional
// leading icon. Status tones are tints with the token as text, so they hold
// contrast in both themes by construction.
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
				'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
				TONES[tone],
				className
			)}
		>
			{icon}
			{children}
		</span>
	)
}

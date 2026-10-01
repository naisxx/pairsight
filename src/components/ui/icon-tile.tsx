import type { ComponentType } from 'react'
import type { IconProps } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

export type TileIcon = ComponentType<IconProps>

const SIZES = {
	// Section and card headings.
	// Explicit radii: this theme's `rounded-lg` is 16 px, which makes a 32 px tile a circle.
	sm: { box: 'size-8 rounded-[8px]', icon: 18 },
	// Empty states: a larger duotone glyph whose second layer is the accent.
	lg: { box: 'size-14 rounded-[14px]', icon: 28 }
} as const

// An icon set in a soft rounded tile, so it has weight without colour. The
// tile sets the duotone accent: coral normally, the danger colour for errors.
export function IconTile({
	icon: Icon,
	size = 'sm',
	tone = 'neutral',
	className
}: {
	icon: TileIcon
	size?: keyof typeof SIZES
	tone?: 'neutral' | 'danger'
	className?: string
}) {
	const { box, icon } = SIZES[size]
	return (
		<span
			aria-hidden
			className={cn(
				'grid shrink-0 place-items-center border shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text)_6%,transparent)]',
				box,
				tone === 'danger'
					? 'bg-danger-subtle border-danger/35 text-danger [--icon-accent:var(--danger)]'
					: 'bg-surface-muted border-border text-text [--icon-accent:var(--action)]',
				'[--icon-accent-opacity:0.5]',
				className
			)}
		>
			<Icon size={icon} variant={size === 'lg' ? 'duotone' : 'line'} />
		</span>
	)
}

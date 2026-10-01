'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

// Long enough that sweeping the pointer across a toolbar doesn't flash tips.
export const TOOLTIP_DELAY_MS = 250

function TooltipProvider({
	delayDuration = TOOLTIP_DELAY_MS,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	)
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

// A quiet card on the elevated surface, not an inverted bubble, and no arrow.
function TooltipContent({
	className,
	sideOffset = 6,
	collisionPadding = 8,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				className={cn(
					'border-border bg-surface-elevated text-text shadow-elevated data-[state=delayed-open]:animate-float-in z-[60] max-w-[260px] rounded-sm border px-2.5 py-1.5 text-xs leading-snug',
					className
				)}
				{...props}
			>
				{children}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	)
}

// The everyday form: wrap one focusable element. `disabled` renders the child
// alone, for tips that only apply in some states.
function Tip({
	content,
	side = 'top',
	disabled,
	children
}: {
	content: React.ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
	disabled?: boolean
	children: React.ReactElement
}) {
	if (disabled) return children
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side}>{content}</TooltipContent>
		</Tooltip>
	)
}

export { Tip, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

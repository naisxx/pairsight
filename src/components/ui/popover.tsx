'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { Popover as PopoverPrimitive } from 'radix-ui'

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
	className,
	align = 'start',
	sideOffset = 6,
	collisionPadding = 12,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				className={cn(
					'border-border bg-surface-elevated text-text shadow-elevated data-[state=open]:animate-float-in z-50 max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) rounded-md border p-4 outline-hidden',
					className
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	)
}

function PopoverClose({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Close>) {
	return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}

export { Popover, PopoverClose, PopoverTrigger, PopoverContent }

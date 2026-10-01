'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { Switch as SwitchPrimitive } from 'radix-ui'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				'peer border-border-input bg-surface-muted data-[state=checked]:border-action data-[state=checked]:bg-action relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-[background-color,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="bg-text-muted data-[state=checked]:bg-action-ink pointer-events-none inline-block size-3.5 translate-x-[2px] rounded-full transition-transform duration-150 ease-out data-[state=checked]:translate-x-[18px]"
			/>
		</SwitchPrimitive.Root>
	)
}

export { Switch }

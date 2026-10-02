'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { Slider as SliderPrimitive } from 'radix-ui'

// A single-thumb slider. Radix supplies the keyboard (arrows, Page Up/Down,
// Home/End) and the slider role; the thumb takes the accessible name.
function Slider({
	className,
	thumbLabel,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel: string }) {
	return (
		<SliderPrimitive.Root
			data-slot="slider"
			className={cn(
				'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50',
				className
			)}
			{...props}
		>
			<SliderPrimitive.Track className="bg-surface-muted border-border relative h-1.5 w-full grow overflow-hidden rounded-full border">
				<SliderPrimitive.Range className="bg-action absolute h-full" />
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				aria-label={thumbLabel}
				className="border-action bg-surface focus-visible:outline-focus block size-4 rounded-full border-2 shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
			/>
		</SliderPrimitive.Root>
	)
}

export { Slider }

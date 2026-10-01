'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { CheckIcon } from '@/components/ui/icons'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

const CHECK_SIZE = 11

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				'peer border-border-input bg-surface text-action-ink data-[state=checked]:border-action data-[state=checked]:bg-action aria-invalid:border-danger flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-[background-color,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
				<CheckIcon size={CHECK_SIZE} variant="bold" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	)
}

export { Checkbox }

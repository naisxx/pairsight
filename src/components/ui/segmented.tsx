'use client'

import { useRef } from 'react'
import { cn } from '@/lib/cn'

export type SegmentOption<T extends string> = {
	value: T
	label: React.ReactNode
	disabled?: boolean
	title?: string
}

// A single choice among a few, shown side by side. It's a radio group: one
// tab stop, and the arrow keys move the selection (skipping disabled
// options), as the ARIA radio pattern expects.
export function Segmented<T extends string>({
	value,
	onChange,
	options,
	label,
	className
}: {
	value: T
	onChange: (value: T) => void
	options: SegmentOption<T>[]
	label: string
	className?: string
}) {
	const buttons = useRef<Array<HTMLButtonElement | null>>([])

	function onKeyDown(event: React.KeyboardEvent, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
		event.preventDefault()
		const direction = event.key === 'ArrowRight' ? 1 : -1
		for (let step = 1; step <= options.length; step++) {
			const next = (index + direction * step + options.length) % options.length
			const option = options[next]
			if (option != null && option.disabled !== true) {
				onChange(option.value)
				buttons.current[next]?.focus()
				return
			}
		}
	}

	return (
		<div
			role="radiogroup"
			aria-label={label}
			className={cn(
				'border-border bg-surface-muted inline-flex items-center gap-0.5 rounded-sm border p-0.5',
				className
			)}
		>
			{options.map((option, index) => {
				const isSelected = option.value === value
				return (
					<button
						key={option.value}
						ref={(element) => {
							buttons.current[index] = element
						}}
						type="button"
						role="radio"
						aria-checked={isSelected}
						tabIndex={isSelected ? 0 : -1}
						disabled={option.disabled}
						title={option.title}
						onClick={() => onChange(option.value)}
						onKeyDown={(event) => onKeyDown(event, index)}
						className={cn(
							'type-ui inline-flex h-7 items-center gap-1.5 rounded-[5px] px-3 font-medium whitespace-nowrap transition-[background-color,color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
							isSelected
								? 'bg-surface text-text shadow-[0_0_0_1px_var(--border)]'
								: 'text-text-muted hover:text-text'
						)}
					>
						{option.label}
					</button>
				)
			})}
		</div>
	)
}

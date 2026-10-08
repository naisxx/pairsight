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
// options), as the ARIA radio pattern expects. The chosen option is a solid
// coral pill (the brand's main variant, the way ClickHouse marks its active
// tab); the rest are quiet text on the track.
export function Segmented<T extends string>({
	value,
	onChange,
	options,
	label,
	isFill = false,
	className
}: {
	value: T
	onChange: (value: T) => void
	options: SegmentOption<T>[]
	label: string
	// Spread the options across the full width, in equal columns, so a few
	// two-line options never wrap the track onto a second row.
	isFill?: boolean
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
				'border-border bg-surface-muted items-center gap-0.5 border p-[3px]',
				isFill ? 'grid w-full auto-cols-fr grid-flow-col rounded-xl' : 'inline-flex rounded-full',
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
							'type-ui inline-flex items-center gap-1.5 font-medium whitespace-nowrap transition-[background-color,color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
							isFill
								? 'min-h-8 flex-col justify-center gap-0 rounded-[9px] px-2 py-1.5 leading-tight pointer-coarse:min-h-11'
								: 'h-8 rounded-full px-3.5 pointer-coarse:h-11',
							isSelected
								? 'bg-action text-action-ink'
								: 'text-text-muted hover:bg-surface hover:text-text'
						)}
					>
						{option.label}
					</button>
				)
			})}
		</div>
	)
}

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
// options), as the ARIA radio pattern expects. The chosen option is a raised
// card on the quiet track; the rest are body text.
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
	// two-line options never wrap the track onto a second row; 'narrow' does
	// so only on a phone, and sits inline otherwise.
	isFill?: boolean | 'narrow'
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
				'border-border bg-surface-muted items-center gap-1 rounded-[14px] border p-1',
				isFill === true
					? 'grid w-full auto-cols-fr grid-flow-col'
					: isFill === 'narrow'
						? 'inline-flex max-[599px]:grid max-[599px]:w-full max-[599px]:auto-cols-fr max-[599px]:grid-flow-col'
						: 'inline-flex',
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
							'inline-flex items-center gap-2 rounded-[10px] text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 in-[fieldset:disabled]:opacity-100',
							isFill === true
								? 'min-h-9 flex-col justify-center gap-0 px-2 py-1.5 leading-tight pointer-coarse:min-h-11'
								: isFill === 'narrow'
									? 'min-h-9 px-3.5 max-[599px]:flex-col max-[599px]:justify-center max-[599px]:gap-0 max-[599px]:px-2 max-[599px]:py-1.5 max-[599px]:leading-tight pointer-coarse:min-h-11'
									: 'min-h-9 px-3.5 pointer-coarse:min-h-11',
							isSelected
								? 'bg-surface text-text shadow-[0_0_0_1px_var(--border)]'
								: 'text-text-body hover:text-text'
						)}
					>
						{option.label}
					</button>
				)
			})}
		</div>
	)
}

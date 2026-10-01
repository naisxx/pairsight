import { cn } from '@/lib/cn'
import { ChevronDownIcon } from './icons'
import { fieldClassName } from './input'

const CARET_SIZE = 14

// The browser's own select, styled as a field: right for filters and short
// lists, where native keyboard and mobile pickers beat a custom listbox.
export function NativeSelect({
	size = 'md',
	className,
	wrapperClassName,
	children,
	...props
}: Omit<React.ComponentProps<'select'>, 'size'> & {
	size?: 'sm' | 'md'
	wrapperClassName?: string
}) {
	return (
		<div className={cn('relative', wrapperClassName)}>
			<select
				className={cn(
					fieldClassName,
					'cursor-pointer appearance-none pr-8',
					size === 'sm' ? 'type-ui h-8' : 'h-9',
					className
				)}
				{...props}
			>
				{children}
			</select>
			<ChevronDownIcon
				size={CARET_SIZE}
				className="text-text-muted pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
			/>
		</div>
	)
}

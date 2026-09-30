import { cn } from '@/lib/cn'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			className={cn(
				'border-border-input bg-surface text-text h-9 w-full rounded border px-3 text-sm',
				'placeholder:text-text-muted',
				'focus-visible:outline-ring focus-visible:outline focus-visible:outline-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	)
}

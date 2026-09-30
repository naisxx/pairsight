import { cn } from '@/lib/cn'

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			className={cn(
				'border-border-input bg-surface text-text type-body min-h-20 w-full rounded border px-3 py-2',
				'placeholder:text-text-muted',
				'focus-visible:outline-ring focus-visible:outline focus-visible:outline-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	)
}
